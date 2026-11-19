// 発行前の請求（請求の詳細・発行・締めの取消のケースで使う）。
import { prepareMemoryDatabase, type Adjustment, type Invoice, type InvoiceTax, type MemoryDatabase, type Refund, type Stored } from '@app/backend/testing'
import { customers, preparePayment, prepareSales } from '../../test/billingFixture'
import type { InvoiceTarget } from './browseInvoice'

/** 発行前の10月の請求。子会社の売上・入金・返金・振込手数料を載せている。 */
export const draftInvoice: Stored<Invoice> = {
  invoiceId: 'invoice-2001',
  billingCustomerId: 'customer-0001',
  previousInvoiceId: null,
  closingDate: '2026-10-31',
  dueDate: '2026-11-30',
  previousAmount: 0,
  paymentAmount: 49_000,
  adjustmentAmount: 440,
  carriedAmount: -49_440,
  salesAmount: 100_000,
  taxAmount: 10_000,
  invoiceAmount: 60_560,
  invoiceNumber: null,
  issueDate: null,
}

const draftTax: Stored<InvoiceTax> = { invoiceId: 'invoice-2001', taxRate: 10, taxableAmount: 100_000, taxAmount: 10_000 }

const draftRefund: Stored<Refund> = {
  refundId: 'refund-0001',
  paymentId: 'payment-0001',
  refundDate: '2026-10-28',
  refundAmount: 1000,
  invoiceId: 'invoice-2001',
}

const draftAdjustment: Stored<Adjustment> = {
  adjustmentId: 'adjustment-0001',
  billingCustomerId: 'customer-0001',
  adjustmentDate: '2026-10-25',
  adjustmentKind: 'transferFee',
  adjustmentAmount: 440,
  paymentId: 'payment-0001',
  invoiceId: 'invoice-2001',
}

/** 発行前の請求を一覧から開くときの選び方。 */
export const draftTarget: InvoiceTarget = { billingCustomer: '株式会社親', closingDate: '2026-10-31' }

export function prepareDraftSeed(seed: Partial<MemoryDatabase> = {}): Partial<MemoryDatabase> {
  return prepareMemoryDatabase({
    customer: customers,
    invoice: [draftInvoice],
    invoiceTax: [draftTax],
    sales: [prepareSales('sales-0001', { customerId: 'customer-0002', salesAmount: 100_000, invoiceId: 'invoice-2001' })],
    payment: [preparePayment('payment-0001', { paymentDate: '2026-10-25', paymentAmount: 50_000, invoiceId: 'invoice-2001' })],
    refund: [draftRefund],
    adjustment: [draftAdjustment],
    ...seed,
  })
}
