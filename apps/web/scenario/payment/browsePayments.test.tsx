// 入金を閲覧するシナリオのケース。
import { confirmScenario, operateScenario } from '@app/flow'
import { describeScenario } from '@app/flow/vitest'
import { prepareText } from '@app/vocabulary/text'
import { customers, issuedOctoberInvoice, preparePayment } from '../../test/billingFixture'
import { launchApp } from '../../test/launchApp'
import { browsePayments } from './browsePayments'

const text = prepareText('ja')

describeScenario(browsePayments, (cases) => {
  cases.main('入金を新しい入金日から並べ、請求に載せたかどうかを出す', async () => {
    const app = await launchApp({
      customer: customers,
      invoice: [issuedOctoberInvoice],
      payment: [
        preparePayment('payment-0001', { paymentDate: '2026-10-20', invoiceId: 'invoice-1001' }),
        preparePayment('payment-0002', { paymentDate: '2026-11-10' }),
      ],
    })
    await operateScenario(browsePayments, app.screen, undefined)

    await confirmScenario(browsePayments, app.screen, undefined)
    await app.screen.expectRows('paymentList', [
      ['2026-11-10', 'カ）オヤ', text.label('transfer'), 10_000, '株式会社親', text.label('unbilled')],
      ['2026-10-20', 'カ）オヤ', text.label('transfer'), 10_000, '株式会社親', text.label('billed')],
    ])
  })
})
