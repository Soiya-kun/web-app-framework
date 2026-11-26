// 入金の画面遷移。入金一覧から入金登録へ移る。売上登録はナビゲーションから開く。
import { describeTransition } from '@app/flow/vitest'
import { customers } from '../test/billingSeed'
import { launchApp } from '../test/launchApp'

describeTransition('paymentTransition', (paths) => {
  paths.trace('入金一覧から入金登録へ移る', async () => {
    const app = await launchApp({ customer: customers })
    await app.screen.go('paymentList')
    await app.screen.expectHeading('paymentList')
    await app.screen.follow('入金登録')
    await app.screen.expectHeading('paymentCreate')
  })

  paths.trace('ナビゲーションから入金登録を開く', async () => {
    const app = await launchApp({ customer: customers })
    await app.screen.go('paymentCreate')
    await app.screen.expectHeading('paymentCreate')
  })
})
