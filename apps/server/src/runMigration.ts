// マイグレーションの単発の実行。本番は ECS のタスクとして、API サーバーと同じイメージで動かす。
import { applyMigrations } from '@app/backend/migration'
import { readServerSetting } from './serverSetting'

const serverSetting = readServerSetting(process.env)
const appliedNames = await applyMigrations(serverSetting.database)
console.log(appliedNames.length === 0 ? '当てるマイグレーションはありません。' : `当てたマイグレーション: ${appliedNames.join('、')}`)
