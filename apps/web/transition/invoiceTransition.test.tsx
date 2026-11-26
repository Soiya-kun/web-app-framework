// 請求の画面遷移。請求一覧から締め・詳細へ移り、締めの取消で一覧へ戻る。
import { describeTransition } from '@app/flow/vitest'
import { customers, prepareSales } from '../test/billingSeed'
import { launchApp } from '../test/launchApp'
import { draftTarget, prepareDraftSeed } from '../scenario/invoice/invoiceSeed'

describeTransition('invoiceTransition', (paths) => {
  paths.trace('請求一覧から請求の締めへ移り、締めると請求詳細になる', async () => {
    const app = await launchApp({ customer: customers, sales: [prepareSales('sales-0001', { salesDate: '2026-10-15', salesAmount: 100_000 })] })
    await app.screen.go('invoiceList')
    await app.screen.expectHeading('invoiceList')
    await app.screen.follow('請求の締め')
    await app.screen.expectHeading('invoiceClosing')
    await app.screen.choose('billingCustomer', '株式会社親')
    await app.screen.fill('closingDate', '2026-10-31')
    await app.screen.press('close')
    await app.screen.expectHeading('invoiceDetail')
  })

  paths.trace('請求一覧の行から請求詳細へ移り、締めを取り消すと請求一覧へ戻る', async () => {
    const app = await launchApp(prepareDraftSeed())
    await app.screen.go('invoiceList')
    await app.screen.expectHeading('invoiceList')
    await app.screen.rowOf('invoiceList', { closingDate: draftTarget.closingDate, billingCustomer: draftTarget.billingCustomer }).follow(draftTarget.closingDate)
    await app.screen.expectHeading('invoiceDetail')
    await app.screen.press('closingCancel')
    await app.screen.expectHeading('invoiceList')
  })

  paths.trace('ナビゲーションから請求の締めを開く', async () => {
    const app = await launchApp({ customer: customers })
    await app.screen.go('invoiceClosing')
    await app.screen.expectHeading('invoiceClosing')
  })
})
