import { defineFlow, occur, operate } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { customers } from '../test/billingFixture'
import { browsePayments } from '../scenario/payment/browsePayments'
import { identifyPayment } from '../scenario/payment/identifyPayment'
import { registerPayment } from '../scenario/payment/registerPayment'

/** 振り込まれた代金を記録し、振込人が分からなければ仮受にして、あとで顧客を特定する。 */
export const paymentManagement = defineFlow<Partial<MemoryDatabase>>('paymentManagement', {
  precondition: { summary: '親会社が顧客として登録されている', seed: { customer: customers } },
  steps: [
    occur('customer', 'payInvoice'),
    operate(
      registerPayment,
      { paymentDate: '2026-11-20', paymentAmount: '110000', payerName: 'カ)オヤ', customer: '株式会社親' },
      {
        unidentifiedPayer: {
          input: { paymentDate: '2026-11-20', paymentAmount: '110000', payerName: 'ヤマダ タロウ', customer: '' },
          then: [operate(identifyPayment, { payerName: 'ヤマダ タロウ', customer: '株式会社親' })],
        },
      },
    ),
    operate(browsePayments),
  ],
})
