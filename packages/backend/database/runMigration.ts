// pnpm database:migrate から呼ぶ。接続先は DATABASE_URL。
import { applyMigrations } from './applyMigrations'

const connectionText = process.env['DATABASE_URL']
if (connectionText === undefined) {
  throw new Error('DATABASE_URL に接続先を指定してください。')
}
const appliedNames = await applyMigrations(connectionText)
console.log(appliedNames.length === 0 ? '当てるマイグレーションはありません。' : `当てたマイグレーション: ${appliedNames.join('、')}`)
