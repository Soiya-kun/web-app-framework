// CDK のアプリ。環境は -c stage=dev のように渡す（既定は cdk.json の dev）。
//   pnpm --filter @app/web build && pnpm --filter @app/infra deploy -c stage=dev
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { App } from 'aws-cdk-lib'
import { Platform } from 'aws-cdk-lib/aws-ecr-assets'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import { IgnoreMode } from 'aws-cdk-lib'
import { AppStack } from '../lib/appStack'
import { readStageSetting } from '../lib/stageSetting'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const webDistPath = join(repositoryRoot, 'apps/web/dist')

const app = new App()
const stageName = String(app.node.tryGetContext('stage') ?? 'dev')

new AppStack(app, `WebAppFramework-${stageName}`, {
  stageSetting: readStageSetting(stageName),
  apiImage: ecs.ContainerImage.fromAsset(repositoryRoot, {
    file: 'apps/server/Dockerfile',
    platform: Platform.LINUX_ARM64,
    ignoreMode: IgnoreMode.DOCKER,
  }),
  webDistPath: existsSync(webDistPath) ? webDistPath : undefined,
  env: { account: process.env['CDK_DEFAULT_ACCOUNT'], region: process.env['CDK_DEFAULT_REGION'] ?? 'ap-northeast-1' },
})
