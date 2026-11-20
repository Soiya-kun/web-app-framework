import { defineFlow, elapse, occur, operate } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { issuedOctoberSeed } from '../../test/billingFixture'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { createAdjustment } from '../../scenario/payment/createAdjustment'
import { registerPayment } from '../../scenario/payment/registerPayment'

export const transferFeeDeduction = defineFlow<Partial<MemoryDatabase>>('transferFeeDeduction', {
  precondition: { summary: '親会社の10月の請求（今回請求額 110,000 円）を発行済み', seed: issuedOctoberSeed },
  steps: [
    occur('customer', 'payInvoice'),
    operate(registerPayment, { paymentDate: '2026-11-20', paymentAmount: '109560', payerName: 'カ)オヤ', customer: '株式会社親' }),
    operate(createAdjustment),
    elapse('closingDate', '2026-11-30'),
    // 差し引かれた振込手数料 440 円を調整額に載せ、繰越額は 0 になる。
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-11-30',
      breakdown: { previousInvoiceAmount: 110_000, currentPaymentAmount: 109_560, adjustmentAmount: 440, carriedAmount: 0, currentInvoiceAmount: 0 },
    }),
  ],
})
