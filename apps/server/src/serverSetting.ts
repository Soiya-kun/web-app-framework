import { readFileSync } from 'node:fs'
import type { DatabaseConnection } from '@app/backend/production'

export type ServerSetting = {
  readonly port: number
  readonly database: DatabaseConnection
}

function readRequired(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]
  if (value === undefined || value === '') {
    throw new Error(`環境変数 ${name} がありません。`)
  }
  return value
}

/**
 * 環境変数から、サーバーの設定を読む。
 * 本番（ECS）は、DB の接続情報を Secrets Manager から DATABASE_HOST などに入れる。手元では DATABASE_URL でもよい。
 * DATABASE_CERTIFICATE_FILE があれば、その証明書で DB を確かめる TLS で接続する。
 */
export function readServerSetting(environment: NodeJS.ProcessEnv): ServerSetting {
  const certificateFile = environment['DATABASE_CERTIFICATE_FILE']
  const urlText = environment['DATABASE_URL']
  const connectionText =
    urlText ??
    `postgres://${encodeURIComponent(readRequired(environment, 'DATABASE_USER'))}:${encodeURIComponent(readRequired(environment, 'DATABASE_PASSWORD'))}@${readRequired(environment, 'DATABASE_HOST')}:${readRequired(environment, 'DATABASE_PORT')}/${readRequired(environment, 'DATABASE_NAME')}`
  return {
    port: Number(environment['PORT'] ?? '3000'),
    database: {
      connectionText,
      certificateText: certificateFile === undefined ? undefined : readFileSync(certificateFile, 'utf8'),
    },
  }
}
