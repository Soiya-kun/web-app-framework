// 業務フローを、実ブラウザ（Chromium）・API サーバー・PostgreSQL で流す。中身はインプロセスの flow.test.tsx と同じ業務フローとシナリオ。
import { preparePostgresPool } from '@app/backend/production'
import type { MemoryDatabase } from '@app/backend/testing'
import type { Flow } from '@app/flow'
import { describeFlow } from '@app/flow/vitest'
import { chromium } from 'playwright'
import { afterAll, beforeAll, inject } from 'vitest'
import { launchBrowserApp, type BrowserTarget } from './launchBrowserApp'

const flowFiles = import.meta.glob<Readonly<Record<string, unknown>>>(['../flow/**/*.ts', '!../flow/**/*.test.ts'], { eager: true })

function isFlow(value: unknown): value is Flow<Partial<MemoryDatabase>> {
  return typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'flow'
}

let target: BrowserTarget | undefined

beforeAll(async () => {
  target = {
    browser: await chromium.launch(),
    pool: preparePostgresPool({ connectionText: inject('databaseUrl') }),
    screenOrigin: inject('screenOrigin'),
  }
})

afterAll(async () => {
  await target?.browser.close()
  await target?.pool.end()
})

for (const flowFile of Object.values(flowFiles)) {
  for (const flow of Object.values(flowFile).filter(isFlow)) {
    describeFlow(flow, (seed) => {
      if (target === undefined) {
        throw new Error('ブラウザを起動していません。')
      }
      return launchBrowserApp(target, seed)
    })
  }
}
