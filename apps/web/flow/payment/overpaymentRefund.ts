import { defineFlow, elapse, occur, operate, outside } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { issuedOctoberSeed } from '../../test/billingSeed'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { createRefund } from '../../scenario/payment/createRefund'
import { registerPayment } from '../../scenario/payment/registerPayment'

export const overpaymentRefund = defineFlow<Partial<MemoryDatabase>>('overpaymentRefund', {
  precondition: { summary: '親会社の10月の請求（今回請求額 110,000 円）を発行済み', seed: issuedOctoberSeed },
  steps: [
    occur('customer', 'payInvoice'),
    operate(registerPayment, { paymentDate: '2026-11-10', paymentAmount: '120000', payerName: 'カ)オヤ', customer: '株式会社親' }),
    operate(createRefund),
    outside('accountant', 'payRefund'),
    elapse('closingDate', '2026-11-30'),
    // 返金した 10,000 円を今回入金額から差し引き、繰越額は 0 になる。
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-11-30',
      breakdown: { previousInvoiceAmount: 110_000, currentPaymentAmount: 110_000, carriedAmount: 0, currentInvoiceAmount: 0 },
    }),
  ],
})
