import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import type { Construct } from 'constructs'
import type { StageSetting } from './stageSetting'

export type AppStackProps = StackProps & {
  readonly stageSetting: StageSetting
  /** API サーバーとマイグレーションのイメージ（apps/server/Dockerfile）。 */
  readonly apiImage: ecs.ContainerImage
  /** 画面のビルドの出力（apps/web/dist）。なければ画面は配備しない。 */
  readonly webDistPath: string | undefined
}

const apiPort = 3000
const certificateFile = '/app/rds-certificate.pem'

/**
 * アプリの全体。
 * - 画面: S3 ＋ CloudFront。/api/* は同じドメインのまま、CloudFront の VPC オリジンで内部の ALB へ振り分ける。
 * - API: ECS Fargate（Hono を Node で常駐）。ALB はインターネットに出さない。
 * - DB: RDS for PostgreSQL。接続情報は Secrets Manager に置き、ECS が環境変数に入れる。TLS で接続する。
 * - マイグレーション: API と同じイメージを、ECS の単発のタスクとして動かす。
 */
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props)
    const { stageSetting } = props

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: stageSetting.natGateways,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'application', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: 'database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    })

    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_17 }),
      instanceType: stageSetting.databaseInstanceType,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromGeneratedSecret('app'),
      databaseName: 'app',
      multiAz: stageSetting.multiAz,
      allocatedStorage: 20,
      storageEncrypted: true,
      backupRetention: Duration.days(7),
      deletionProtection: stageSetting.deletionProtection,
      removalPolicy: stageSetting.removalPolicy,
    })
    const databaseSecret = database.secret
    if (databaseSecret === undefined) {
      throw new Error('DB の接続情報の Secret がありません。')
    }
    const databaseSecrets = {
      DATABASE_HOST: ecs.Secret.fromSecretsManager(databaseSecret, 'host'),
      DATABASE_PORT: ecs.Secret.fromSecretsManager(databaseSecret, 'port'),
      DATABASE_NAME: ecs.Secret.fromSecretsManager(databaseSecret, 'dbname'),
      DATABASE_USER: ecs.Secret.fromSecretsManager(databaseSecret, 'username'),
      DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(databaseSecret, 'password'),
    }
    const databaseEnvironment = { DATABASE_CERTIFICATE_FILE: certificateFile }
    const runtimePlatform = {
      cpuArchitecture: ecs.CpuArchitecture.ARM64,
      operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
    }

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc, containerInsightsV2: ecs.ContainerInsights.ENABLED })
    const api = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Api', {
      cluster,
      publicLoadBalancer: false,
      openListener: false,
      desiredCount: stageSetting.apiDesiredCount,
      minHealthyPercent: 100,
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      taskImageOptions: {
        image: props.apiImage,
        containerPort: apiPort,
        secrets: databaseSecrets,
        environment: { ...databaseEnvironment, PORT: String(apiPort) },
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logRetention: logs.RetentionDays.ONE_MONTH }),
      },
    })
    api.targetGroup.configureHealthCheck({ path: '/api/health', healthyHttpCodes: '200' })
    // CloudFront の VPC オリジンは VPC の中から ALB へつなぐので、VPC の中からだけ受ける。
    api.loadBalancer.connections.allowFrom(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(80))
    database.connections.allowDefaultPortFrom(api.service)

    const migrationSecurityGroup = new ec2.SecurityGroup(this, 'MigrationSecurityGroup', { vpc })
    database.connections.allowDefaultPortFrom(migrationSecurityGroup)
    const migrationTask = new ecs.FargateTaskDefinition(this, 'MigrationTask', { cpu: 256, memoryLimitMiB: 512, runtimePlatform })
    migrationTask.addContainer('Migration', {
      image: props.apiImage,
      command: ['node', 'runMigration.mjs'],
      secrets: databaseSecrets,
      environment: databaseEnvironment,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'migration', logRetention: logs.RetentionDays.ONE_MONTH }),
    })

    const webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: stageSetting.removalPolicy,
      autoDeleteObjects: stageSetting.stageName !== 'prod',
    })
    // 画面の道筋（/invoices/… など）は、ファイルがなくても index.html を返す。/api/* には当てない。
    const spaFunction = new cloudfront.Function(this, 'SpaFunction', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        "function handler(event) { var request = event.request; if (request.uri.indexOf('.') === -1) { request.uri = '/index.html'; } return request; }",
      ),
    })
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [{ function: spaFunction, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: origins.VpcOrigin.withApplicationLoadBalancer(api.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    })
    if (props.webDistPath !== undefined) {
      new s3deploy.BucketDeployment(this, 'WebDeployment', {
        sources: [s3deploy.Source.asset(props.webDistPath)],
        destinationBucket: webBucket,
        distribution,
        distributionPaths: ['/*'],
      })
    }

    const applicationSubnetIds = vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds
    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` })
    new CfnOutput(this, 'MigrationCommand', {
      description: 'マイグレーションを当てるコマンド（配備のたびに、API の更新の前に実行する）',
      value: [
        'aws ecs run-task',
        `--cluster ${cluster.clusterName}`,
        `--task-definition ${migrationTask.taskDefinitionArn}`,
        '--launch-type FARGATE',
        `--network-configuration "awsvpcConfiguration={subnets=[${Stack.of(this).toJsonString(applicationSubnetIds)}],securityGroups=[${migrationSecurityGroup.securityGroupId}],assignPublicIp=DISABLED}"`,
      ].join(' '),
    })
  }
}
