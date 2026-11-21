import { defineFlow, elapse, operate } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { issuedOctoberSeed } from '../../test/billingSeed'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { registerPayment } from '../../scenario/payment/registerPayment'
import { createSales } from '../../scenario/sales/createSales'
import { deliverProduct, payInvoice } from '../../step/step'

export const underpayment = defineFlow<Partial<MemoryDatabase>>('underpayment', {
  precondition: { summary: '親会社の10月の請求（今回請求額 110,000 円）を発行済み', seed: issuedOctoberSeed },
  steps: [
    deliverProduct,
    operate(createSales, { customer: '株式会社親', salesDate: '2026-11-15', salesKind: '通常', itemName: '運賃', salesAmount: '50000', taxRate: '10%' }),
    payInvoice,
    operate(registerPayment, { paymentDate: '2026-11-20', paymentAmount: '100000', payerName: 'カ)オヤ', customer: '株式会社親' }),
    elapse('closingDate', '2026-11-30'),
    // 足りない 10,000 円は繰越額として、11月の売上と一緒に請求する。
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-11-30',
      breakdown: {
        previousInvoiceAmount: 110_000,
        currentPaymentAmount: 100_000,
        carriedAmount: 10_000,
        currentSalesAmount: 50_000,
        taxAmount: 5_000,
        currentInvoiceAmount: 65_000,
      },
    }),
  ],
})
