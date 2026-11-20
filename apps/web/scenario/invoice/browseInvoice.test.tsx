// 請求を閲覧するシナリオのケース。残高を繰り越す請求書の並びと、載せた行・発行の状態の出し方を確かめる。
import { confirmScenario, operateScenario } from '@app/flow'
import { describeScenario } from '@app/flow/vitest'
import { prepareText } from '@app/vocabulary/text'
import { customers, issuedOctoberInvoice } from '../../test/billingSeed'
import { launchApp } from '../../test/launchApp'
import { browseInvoice } from './browseInvoice'
import { draftTarget, prepareDraftSeed } from './invoiceSeed'

const text = prepareText('ja')

describeScenario(browseInvoice, (cases) => {
  cases.main('残高を繰り越す請求書の並びで金額を出し、載せた売上・入金・返金・調整を並べる', async () => {
    const app = await launchApp(prepareDraftSeed())
    await operateScenario(browseInvoice, app.screen, draftTarget)

    await confirmScenario(browseInvoice, app.screen, draftTarget)
    await app.screen.expectRows('invoiceBreakdown', [[0, 49_000, 440, -49_440, 100_000, 10_000, 60_560]])
    await app.screen.expectRows('taxBreakdown', [['10%', 100_000, 10_000]])
    await app.screen.expectRows('billedSales', [['2026-10-15', '運賃', text.label('normal'), '10%', 100_000]])
    await app.screen.expectRows('billedPayments', [
      ['2026-10-25', text.label('payment'), 'カ）オヤ', 50_000],
      ['2026-10-28', text.label('refund'), '—', -1000],
      ['2026-10-25', text.label('transferFee'), '—', 440],
    ])
  })

  cases.vary('請求の一覧に、請求先・入金期日・今回請求額と、未発行かどうかを出す', async () => {
    const app = await launchApp(prepareDraftSeed())
    await app.screen.go('invoiceList')

    await app.screen.expectRows('invoiceList', [['2026-10-31', '株式会社親', '2026-11-30', 60_560, text.label('unissued')]])
  })

  cases.vary('発行した請求には、請求番号を出し、発行と締めの取消の操作を出さない', async () => {
    const app = await launchApp({ customer: customers, invoice: [issuedOctoberInvoice] })
    await operateScenario(browseInvoice, app.screen, draftTarget)

    await app.screen.expectText('2026-000001')
    await app.screen.expectNoButton('issue')
    await app.screen.expectNoButton('closingCancel')
  })

})
