import { RemovalPolicy } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'

/** 環境（stage）ごとに変える設定。prod 以外（dev・stg など）は費用を抑えた設定にする。 */
export type StageSetting = {
  readonly stageName: string
  readonly natGateways: number
  readonly databaseInstanceType: ec2.InstanceType
  readonly multiAz: boolean
  readonly apiDesiredCount: number
  readonly deletionProtection: boolean
  readonly removalPolicy: RemovalPolicy
}

export function readStageSetting(stageName: string): StageSetting {
  if (stageName === 'prod') {
    return {
      stageName,
      natGateways: 2,
      databaseInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM),
      multiAz: true,
      apiDesiredCount: 2,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    }
  }
  return {
    stageName,
    natGateways: 1,
    databaseInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
    multiAz: false,
    apiDesiredCount: 1,
    deletionProtection: false,
    removalPolicy: RemovalPolicy.DESTROY,
  }
}
