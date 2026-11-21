import { defineFlow, elapse, operate } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { issuedOctoberSeed } from '../../test/billingSeed'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { issueInvoice } from '../../scenario/invoice/issueInvoice'
import { registerPayment } from '../../scenario/payment/registerPayment'
import { createSales } from '../../scenario/sales/createSales'
import { deliverProduct, payInvoice, sendInvoice } from '../../step/step'

export const bulkPayment = defineFlow<Partial<MemoryDatabase>>('bulkPayment', {
  precondition: { summary: '親会社の10月の請求（今回請求額 110,000 円）を発行済みで、入金はまだない', seed: issuedOctoberSeed },
  steps: [
    deliverProduct,
    operate(createSales, { customer: '株式会社親', salesDate: '2026-11-15', salesKind: '通常', itemName: '運賃', salesAmount: '50000', taxRate: '10%' }),
    elapse('closingDate', '2026-11-30'),
    // 10月の未入金は繰越額として、11月の請求に載る。
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-11-30',
      breakdown: {
        previousInvoiceAmount: 110_000,
        currentPaymentAmount: 0,
        carriedAmount: 110_000,
        currentSalesAmount: 50_000,
        taxAmount: 5_000,
        currentInvoiceAmount: 165_000,
      },
    }),
    operate(issueInvoice, { billingCustomer: '株式会社親', closingDate: '2026-11-30', issueDate: '2026-12-01' }),
    sendInvoice,
    payInvoice,
    operate(registerPayment, { paymentDate: '2026-12-20', paymentAmount: '165000', payerName: 'カ)オヤ', customer: '株式会社親' }),
    elapse('closingDate', '2026-12-31'),
    // 2か月分をまとめて受け取り、繰越額は 0 になる。
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-12-31',
      breakdown: { previousInvoiceAmount: 165_000, currentPaymentAmount: 165_000, carriedAmount: 0, currentInvoiceAmount: 0 },
    }),
  ],
})
