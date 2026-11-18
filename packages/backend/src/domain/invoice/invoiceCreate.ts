import type { AdjustmentId } from '../adjustment/value/adjustmentId'
import type { Customer } from '../customer/entity'
import type { PaymentId } from '../payment/value/paymentId'
import type { RefundId } from '../refund/value/refundId'
import type { SalesId } from '../sales/value/salesId'
import type { Brand } from '../shared/brand'
import { ConflictError } from '../shared/error'
import { sumYen, type Yen } from '../shared/yen'
import type { ClosingInput } from './closingRequest'
import type { Invoice, InvoiceTax, UnbilledEntries } from './entity'
import { calculateInvoiceTaxes } from './invoiceTaxKnowledge'
import { decideDueDate } from './value/dueDate'
import type { InvoiceId } from './value/invoiceId'

/**
 * 締めで保存する値。invoice と taxes が、そのまま invoice・invoice_tax テーブルの行になる。
 * 各 ID の行には、invoice_id にこの請求を入れる（請求に載せる）。
 */
type InvoiceCreateValue = {
  readonly invoice: Invoice
  readonly taxes: readonly InvoiceTax[]
  readonly salesIds: readonly SalesId[]
  readonly paymentIds: readonly PaymentId[]
  readonly refundIds: readonly RefundId[]
  readonly adjustmentIds: readonly AdjustmentId[]
}

export type InvoiceCreate = Brand<InvoiceCreateValue, 'InvoiceCreate'>

/** 前回の請求がなく、載せる行もなければ、締める対象がない。 */
function isEmptyClosing(latestInvoice: Invoice | undefined, unbilledEntries: UnbilledEntries): boolean {
  const entryCount =
    unbilledEntries.sales.length + unbilledEntries.payments.length + unbilledEntries.refunds.length + unbilledEntries.adjustments.length
  return entryCount === 0 && (latestInvoice === undefined || latestInvoice.invoiceAmount === 0)
}

/**
 * 前回の請求と、請求締め日までに載せていない行から、請求の金額を決めるため（残高を繰り越す請求書）。
 * 今回入金額は入金から返金を引いた額。繰越額が負なら前受として次へ繰り越す。
 */
export function planInvoiceCreate(
  invoiceId: InvoiceId,
  billingCustomer: Customer,
  latestInvoice: Invoice | undefined,
  closingInput: ClosingInput,
  unbilledEntries: UnbilledEntries,
): InvoiceCreate {
  if (isEmptyClosing(latestInvoice, unbilledEntries)) {
    throw new ConflictError('emptyClosing')
  }
  const previousAmount = (latestInvoice?.invoiceAmount ?? 0) as Yen
  const paymentAmount = (sumYen(unbilledEntries.payments.map((payment) => payment.paymentAmount)) -
    sumYen(unbilledEntries.refunds.map((refund) => refund.refundAmount))) as Yen
  const adjustmentAmount = sumYen(unbilledEntries.adjustments.map((adjustment) => adjustment.adjustmentAmount))
  const carriedAmount = (previousAmount - paymentAmount - adjustmentAmount) as Yen
  const taxes = calculateInvoiceTaxes(invoiceId, unbilledEntries.sales)
  const salesAmount = sumYen(unbilledEntries.sales.map((sales) => sales.salesAmount))
  const taxAmount = sumYen(taxes.map((tax) => tax.taxAmount))
  const invoice: Invoice = {
    invoiceId,
    billingCustomerId: billingCustomer.customerId,
    previousInvoiceId: latestInvoice?.invoiceId ?? null,
    closingDate: closingInput.closingDate,
    dueDate: decideDueDate(closingInput.closingDate, billingCustomer.collectionMonthOffset, billingCustomer.collectionDay),
    previousAmount,
    paymentAmount,
    adjustmentAmount,
    carriedAmount,
    salesAmount,
    taxAmount,
    invoiceAmount: (carriedAmount + salesAmount + taxAmount) as Yen,
    invoiceNumber: null,
    issueDate: null,
  }
  const invoiceCreate: InvoiceCreateValue = {
    invoice,
    taxes,
    salesIds: unbilledEntries.sales.map((sales) => sales.salesId),
    paymentIds: unbilledEntries.payments.map((payment) => payment.paymentId),
    refundIds: unbilledEntries.refunds.map((refund) => refund.refundId),
    adjustmentIds: unbilledEntries.adjustments.map((adjustment) => adjustment.adjustmentId),
  }
  return invoiceCreate as InvoiceCreate
}
