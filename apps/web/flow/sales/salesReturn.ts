import { defineFlow, elapse, occur, operate, outside } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { customers } from '../../test/billingSeed'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { createSales } from '../../scenario/sales/createSales'
import { customer, salesperson } from '../../role/role'

export const salesReturn = defineFlow<Partial<MemoryDatabase>>('salesReturn', {
  precondition: { summary: '親会社（末締め翌月末払い）が顧客として登録されている', seed: { customer: customers } },
  steps: [
    outside(salesperson, 'deliverProduct'),
    operate(createSales, { customer: '株式会社親', salesDate: '2026-10-05', salesKind: '通常', itemName: '運賃', salesAmount: '100000', taxRate: '10%' }),
    occur(customer, 'sendReturn'),
    // 返品は正の金額で入れ、負の金額の売上として持つ。
    operate(createSales, { customer: '株式会社親', salesDate: '2026-10-20', salesKind: '返品', itemName: '運賃', salesAmount: '20000', taxRate: '10%' }),
    elapse('closingDate', '2026-10-31'),
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-10-31',
      breakdown: { currentSalesAmount: 80_000, taxAmount: 8_000, currentInvoiceAmount: 88_000 },
    }),
  ],
})
