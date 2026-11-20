// 実ブラウザの E2E の前に、テスト用の PostgreSQL にマイグレーションを当て、API サーバーと画面の開発サーバーを起動する。
// 画面は本番と同じく /api を API サーバーへ中継する。テストは画面の URL と DB の接続先を inject で受け取る。
import { fileURLToPath } from 'node:url'
import { prepareApp } from '@app/backend'
import { applyMigrations } from '@app/backend/migration'
import { preparePoolDependency, preparePostgresPool } from '@app/backend/production'
import { serve } from '@hono/node-server'
import { createServer } from 'vite'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    readonly screenOrigin: string
    readonly databaseUrl: string
  }
}

/** テスト用の PostgreSQL（docker compose の test-database）。 */
const databaseUrl = process.env['TEST_DATABASE_URL'] ?? 'postgres://app:app@localhost:55433/app'

export default async function prepareBrowserTest(testRun: TestProject): Promise<() => Promise<void>> {
  await applyMigrations({ connectionText: databaseUrl })
  const pool = preparePostgresPool({ connectionText: databaseUrl })
  const app = prepareApp(preparePoolDependency(pool))
  const apiServer = await new Promise<{ readonly server: ReturnType<typeof serve>; readonly port: number }>((finish) => {
    const server = serve({ fetch: app.fetch, port: 0 }, (address) => finish({ server, port: address.port }))
  })
  const screenServer = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    logLevel: 'warn',
    server: { proxy: { '/api': `http://localhost:${apiServer.port}` } },
  })
  await screenServer.listen()
  const screenOrigin = screenServer.resolvedUrls?.local[0]
  if (screenOrigin === undefined) {
    throw new Error('画面の開発サーバーの URL が分かりません。')
  }
  testRun.provide('screenOrigin', screenOrigin)
  testRun.provide('databaseUrl', databaseUrl)
  return async () => {
    await screenServer.close()
    await new Promise((finish) => apiServer.server.close(finish))
    await pool.end()
  }
}
