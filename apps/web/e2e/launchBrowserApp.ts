import type { preparePostgresPool } from '@app/backend/production'
import { resetTables, seedTables } from '@app/backend/seed'
import type { MemoryDatabase } from '@app/backend/testing'
import { preparePlaywrightScreen } from '@app/flow/playwright'
import type { FlowApp } from '@app/flow/vitest'
import { prepareText } from '@app/vocabulary/text'
import type { Browser } from 'playwright'
import { displayYen } from '../src/shared/yen'

export type BrowserTarget = {
  readonly browser: Browser
  readonly pool: ReturnType<typeof preparePostgresPool>
  readonly screenOrigin: string
}

/**
 * DB を空にして事前条件の行を入れ、画面を最初のページから実ブラウザで開く。
 * シナリオの操作の言い方（Screen）は、インプロセスのテストと同じ。
 */
export async function launchBrowserApp(target: BrowserTarget, seed: Partial<MemoryDatabase> = {}): Promise<FlowApp> {
  await resetTables(target.pool)
  await seedTables(target.pool, seed)
  const context = await target.browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo' })
  const page = await context.newPage()
  page.setDefaultTimeout(10_000)
  await page.goto(target.screenOrigin)
  return {
    screen: preparePlaywrightScreen({ page, text: prepareText('ja'), formatAmount: (amount) => displayYen('ja', amount) }),
    setToday: (date) => page.clock.setFixedTime(new Date(`${date}T09:00:00+09:00`)),
    close: () => context.close(),
  }
}
