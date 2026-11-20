import { defineFlow, elapse, operate, outside } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { customers } from '../../test/billingFixture'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { issueInvoice } from '../../scenario/invoice/issueInvoice'
import { createSales } from '../../scenario/sales/createSales'

export const backdatedSales = defineFlow<Partial<MemoryDatabase>>('backdatedSales', {
  precondition: { summary: '親会社（末締め翌月末払い）が顧客として登録されている', seed: { customer: customers } },
  steps: [
    outside('salesperson', 'deliverProduct'),
    operate(createSales, { customer: '株式会社親', salesDate: '2026-10-15', salesKind: '通常', itemName: '運賃', salesAmount: '100000', taxRate: '10%' }),
    elapse('closingDate', '2026-10-31'),
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-10-31',
      breakdown: { currentSalesAmount: 100_000, taxAmount: 10_000, currentInvoiceAmount: 110_000 },
    }),
    operate(issueInvoice, { billingCustomer: '株式会社親', closingDate: '2026-10-31', issueDate: '2026-11-02' }),
    // 発行した後に、10月の売上の登録漏れに気づいて登録する。10月の請求は変えない。
    operate(createSales, { customer: '株式会社親', salesDate: '2026-10-25', salesKind: '通常', itemName: '保管料', salesAmount: '30000', taxRate: '10%' }),
    elapse('closingDate', '2026-11-30'),
    // まだどの請求にも載っていないので、11月の請求に載る。
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-11-30',
      breakdown: {
        previousInvoiceAmount: 110_000,
        carriedAmount: 110_000,
        currentSalesAmount: 30_000,
        taxAmount: 3_000,
        currentInvoiceAmount: 143_000,
      },
    }),
  ],
})
