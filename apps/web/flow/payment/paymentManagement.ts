import { defineFlow, occur, operate, outside } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { customers } from '../../test/billingFixture'
import { browsePayments } from '../../scenario/payment/browsePayments'
import { createRefund } from '../../scenario/payment/createRefund'
import { identifyPayment } from '../../scenario/payment/identifyPayment'
import { registerPayment } from '../../scenario/payment/registerPayment'

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
        // 他社宛の誤入金は、仮受のまま全額を返金する（請求には載せない）。
        mistakenPayment: {
          input: { paymentDate: '2026-11-20', paymentAmount: '50000', payerName: 'カ)タシャ', customer: '' },
          then: [operate(createRefund), outside('accountant', 'payRefund')],
        },
      },
    ),
    operate(browsePayments),
  ],
})
