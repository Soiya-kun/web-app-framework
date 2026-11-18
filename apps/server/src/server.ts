// 本番の API サーバー。ECS（Fargate）で常駐し、CloudFront → ALB から /api/* を受ける。
import { prepareApp } from '@app/backend'
import { prepareProductionDependency } from '@app/backend/production'
import { serve } from '@hono/node-server'
import { readServerSetting } from './serverSetting'

const serverSetting = readServerSetting(process.env)
const app = prepareApp(prepareProductionDependency(serverSetting.database))

serve({ fetch: app.fetch, port: serverSetting.port }, (address) => {
  console.log(`API サーバーを ${address.port} 番で起動しました。`)
})
