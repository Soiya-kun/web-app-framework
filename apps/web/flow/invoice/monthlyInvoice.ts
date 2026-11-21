import { defineFlow, elapse, nest, operate } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { customers } from '../../test/billingSeed'
import { browseInvoice } from '../../scenario/invoice/browseInvoice'
import { cancelClosing } from '../../scenario/invoice/cancelClosing'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { issueInvoice } from '../../scenario/invoice/issueInvoice'
import { createSales } from '../../scenario/sales/createSales'
import { paymentManagement } from '../payment/paymentManagement'
import { deliverProduct, sendInvoice } from '../../step/step'

const october = { billingCustomer: '株式会社親', closingDate: '2026-10-31' }

export const monthlyInvoice = defineFlow<Partial<MemoryDatabase>>('monthlyInvoice', {
  precondition: { summary: '親会社（末締め翌月末払い）と、請求先を親会社にした子会社が、顧客として登録されている', seed: { customer: customers } },
  steps: [
    deliverProduct,
    operate(createSales, { customer: '株式会社子', salesDate: '2026-10-15', salesKind: '通常', itemName: '運賃', salesAmount: '100000', taxRate: '10%' }),
    elapse('closingDate', '2026-10-31'),
    operate(closeInvoice, { ...october, breakdown: { currentSalesAmount: 100_000, taxAmount: 10_000, currentInvoiceAmount: 110_000 } }),
    operate(browseInvoice, october, {
      mistakenInvoice: {
        input: october,
        then: [
          operate(cancelClosing, october),
          operate(createSales, { customer: '株式会社親', salesDate: '2026-10-28', salesKind: '通常', itemName: '保管料', salesAmount: '20000', taxRate: '10%' }),
          operate(closeInvoice, { ...october, breakdown: { currentSalesAmount: 120_000, taxAmount: 12_000, currentInvoiceAmount: 132_000 } }),
          operate(issueInvoice, { ...october, issueDate: '2026-11-02' }),
        ],
        // 締め直すと請求額が変わり、本線の入金・次の締めの金額と合わなくなるので、発行までで経路を終える。
        resume: false,
      },
    }),
    operate(issueInvoice, { ...october, issueDate: '2026-11-02' }),
    sendInvoice,
    nest(paymentManagement),
    elapse('closingDate', '2026-11-30'),
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-11-30',
      breakdown: { previousInvoiceAmount: 110_000, currentPaymentAmount: 110_000, carriedAmount: 0, currentInvoiceAmount: 0 },
    }),
  ],
})
