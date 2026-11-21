import { defineFlow, elapse, occur, operate, outside } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { issuedOctoberSeed } from '../../test/billingSeed'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { registerPayment } from '../../scenario/payment/registerPayment'
import { createSales } from '../../scenario/sales/createSales'
import { customer, salesperson } from '../../role/role'

export const overpayment = defineFlow<Partial<MemoryDatabase>>('overpayment', {
  precondition: { summary: '親会社の10月の請求（今回請求額 110,000 円）を発行済み', seed: issuedOctoberSeed },
  steps: [
    outside(salesperson, 'deliverProduct'),
    operate(createSales, { customer: '株式会社親', salesDate: '2026-11-15', salesKind: '通常', itemName: '運賃', salesAmount: '50000', taxRate: '10%' }),
    occur(customer, 'payInvoice'),
    operate(registerPayment, { paymentDate: '2026-11-20', paymentAmount: '120000', payerName: 'カ)オヤ', customer: '株式会社親' }),
    elapse('closingDate', '2026-11-30'),
    // 多く受け取った 10,000 円は負の繰越額（前受）として、11月の請求から差し引く。
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-11-30',
      breakdown: {
        previousInvoiceAmount: 110_000,
        currentPaymentAmount: 120_000,
        carriedAmount: -10_000,
        currentSalesAmount: 50_000,
        taxAmount: 5_000,
        currentInvoiceAmount: 45_000,
      },
    }),
  ],
})
