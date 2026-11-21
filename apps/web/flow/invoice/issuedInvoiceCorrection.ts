import { defineFlow, elapse, occur, operate } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { issuedOctoberSeed } from '../../test/billingSeed'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { registerPayment } from '../../scenario/payment/registerPayment'
import { createSales } from '../../scenario/sales/createSales'
import { customer } from '../../role/role'

export const issuedInvoiceCorrection = defineFlow<Partial<MemoryDatabase>>('issuedInvoiceCorrection', {
  precondition: { summary: '親会社の10月の請求（今回請求額 110,000 円）を発行済み。売上を 10,000 円多く載せていた', seed: issuedOctoberSeed },
  steps: [
    // 発行した請求は変えない。多すぎた売上は、値引の売上として次の請求で直す。
    operate(createSales, { customer: '株式会社親', salesDate: '2026-11-05', salesKind: '値引', itemName: '運賃の訂正', salesAmount: '10000', taxRate: '10%' }),
    occur(customer, 'payInvoice'),
    operate(registerPayment, { paymentDate: '2026-11-20', paymentAmount: '110000', payerName: 'カ)オヤ', customer: '株式会社親' }),
    elapse('closingDate', '2026-11-30'),
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-11-30',
      breakdown: {
        previousInvoiceAmount: 110_000,
        currentPaymentAmount: 110_000,
        carriedAmount: 0,
        currentSalesAmount: -10_000,
        taxAmount: -1_000,
        currentInvoiceAmount: -11_000,
      },
    }),
  ],
})
