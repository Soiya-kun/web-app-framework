import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import { describe, expect, test } from 'vitest'
import { AppStack } from '../lib/appStack'
import { readStageSetting } from '../lib/stageSetting'

function synthesizeStack(stageName: string): Template {
  const app = new App()
  const stack = new AppStack(app, 'TestStack', {
    stageSetting: readStageSetting(stageName),
    apiImage: ecs.ContainerImage.fromRegistry('public.ecr.aws/docker/library/node:22-alpine'),
    webDistPath: undefined,
  })
  return Template.fromStack(stack)
}

describe('AWS の構成', () => {
  const template = synthesizeStack('dev')

  test('DB は PostgreSQL 17 の RDS で、暗号化し、インターネットから届かないサブネットに置く', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      EngineVersion: Match.stringLikeRegexp('^17'),
      StorageEncrypted: true,
      PubliclyAccessible: false,
    })
  })

  test('API の ALB はインターネットに出さない（CloudFront の VPC オリジンからだけ受ける）', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', { Scheme: 'internal' })
    template.hasResourceProperties('AWS::CloudFront::VpcOrigin', Match.anyValue())
  })

  test('API は DB の接続情報を Secrets Manager から受け、死活監視は /api/health で行う', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Secrets: Match.arrayWith([Match.objectLike({ Name: 'DATABASE_PASSWORD' })]),
          Environment: Match.arrayWith([Match.objectLike({ Name: 'DATABASE_CERTIFICATE_FILE' })]),
        }),
      ]),
    })
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', { HealthCheckPath: '/api/health' })
  })

  test('CloudFront は画面を S3 から、/api/* を API から返す', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([Match.objectLike({ PathPattern: '/api/*' })]),
      }),
    })
  })

  test('マイグレーションは API と同じイメージの単発のタスクで動かす', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([Match.objectLike({ Command: ['node', 'runMigration.mjs'] })]),
    })
  })

  test('prod は DB を複数の AZ に置き、削除から守る', () => {
    const prodTemplate = synthesizeStack('prod')

    prodTemplate.hasResourceProperties('AWS::RDS::DBInstance', { MultiAZ: true, DeletionProtection: true })
    expect(prodTemplate.findResources('AWS::EC2::NatGateway')).toSatisfy((natGateways: object) => Object.keys(natGateways).length === 2)
  })
})
