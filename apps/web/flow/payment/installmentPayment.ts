import { defineFlow, elapse, operate } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { issuedOctoberSeed } from '../../test/billingSeed'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { registerPayment } from '../../scenario/payment/registerPayment'
import { payInvoice } from '../../step/step'

export const installmentPayment = defineFlow<Partial<MemoryDatabase>>('installmentPayment', {
  precondition: { summary: '親会社の10月の請求（今回請求額 110,000 円）を発行済み', seed: issuedOctoberSeed },
  steps: [
    payInvoice,
    operate(registerPayment, { paymentDate: '2026-11-10', paymentAmount: '60000', payerName: 'カ)オヤ', customer: '株式会社親' }),
    payInvoice,
    operate(registerPayment, { paymentDate: '2026-11-25', paymentAmount: '50000', payerName: 'カ)オヤ', customer: '株式会社親' }),
    elapse('closingDate', '2026-11-30'),
    // 2回の入金を合計して今回入金額に載せ、繰越額は 0 になる。
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-11-30',
      breakdown: { previousInvoiceAmount: 110_000, currentPaymentAmount: 110_000, carriedAmount: 0, currentInvoiceAmount: 0 },
    }),
  ],
})
