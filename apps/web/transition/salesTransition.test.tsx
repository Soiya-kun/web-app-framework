// 売上の画面遷移。売上登録はナビゲーションから開き、登録しても同じ画面に残る。
import { describeTransition } from '@app/flow/vitest'
import { customers } from '../test/billingSeed'
import { launchApp } from '../test/launchApp'

describeTransition('salesTransition', (paths) => {
  paths.trace('ナビゲーションから売上登録を開く', async () => {
    const app = await launchApp({ customer: customers })
    await app.screen.go('salesCreate')
    await app.screen.expectHeading('salesCreate')
  })
})
