import type { Adjustment } from '../adjustment/entity'
import type { CustomerId } from '../customer/value/customerId'
import type { CustomerName } from '../customer/value/customerName'
import type { Payment } from '../payment/entity'
import type { Refund } from '../refund/entity'
import type { Sales } from '../sales/entity'
import type { TaxRate } from '../sales/value/taxRate'
import type { Stored } from '../shared/brand'
import type { Yen } from '../shared/yen'
import type { ClosingDate } from './value/closingDate'
import type { DueDate } from './value/dueDate'
import type { InvoiceId } from './value/invoiceId'
import type { InvoiceNumber } from './value/invoiceNumber'
import type { IssueDate } from './value/issueDate'

/**
 * 請求（残高を繰り越す請求書）。項目は invoice テーブルの列と同じで、そのまま請求書の見出しになる。
 * 繰越額 = 前回請求額 − 今回入金額 − 調整額、今回請求額 = 繰越額 + 今回売上額 + 消費税額。
 * invoiceNumber・issueDate が null の請求は発行前で、締めを取り消せる。
 */
export type Invoice = {
  readonly invoiceId: InvoiceId
  readonly billingCustomerId: CustomerId
  readonly previousInvoiceId: InvoiceId | null
  readonly closingDate: ClosingDate
  readonly dueDate: DueDate
  readonly previousAmount: Yen
  readonly paymentAmount: Yen
  readonly adjustmentAmount: Yen
  readonly carriedAmount: Yen
  readonly salesAmount: Yen
  readonly taxAmount: Yen
  readonly invoiceAmount: Yen
  readonly invoiceNumber: InvoiceNumber | null
  readonly issueDate: IssueDate | null
}

/** 請求の税率ごとの合計と消費税額。項目は invoice_tax テーブルの列と同じ。 */
export type InvoiceTax = {
  readonly invoiceId: InvoiceId
  readonly taxRate: TaxRate
  readonly taxableAmount: Yen
  readonly taxAmount: Yen
}

/** 一覧に出す請求。請求先の名前を添える。 */
export type InvoiceListItem = Invoice & { readonly billingCustomerName: CustomerName }

/** 請求書に載せる中身。見出しと、税率ごとの合計と、載せた売上・入金・返金・調整。 */
export type InvoiceDetail = {
  readonly invoice: InvoiceListItem
  readonly taxes: readonly InvoiceTax[]
  readonly sales: readonly Sales[]
  readonly payments: readonly Payment[]
  readonly refunds: readonly Refund[]
  readonly adjustments: readonly Adjustment[]
}

/** 締めるときに、請求に載せる行。請求締め日までの、まだどの請求にも載せていない行。 */
export type UnbilledEntries = {
  readonly sales: readonly Sales[]
  readonly payments: readonly Payment[]
  readonly refunds: readonly Refund[]
  readonly adjustments: readonly Adjustment[]
}

/** 保存済みの値から請求を組み立てるため。保存済みの値は DB の制約で検証済みとして扱う。 */
export function restoreInvoice(stored: Stored<Invoice>): Invoice {
  return stored as Invoice
}

/** 保存済みの値から一覧の請求を組み立てるため。 */
export function restoreInvoiceListItem(stored: Stored<InvoiceListItem>): InvoiceListItem {
  return stored as InvoiceListItem
}

/** 保存済みの値から税率ごとの合計を組み立てるため。 */
export function restoreInvoiceTax(stored: Stored<InvoiceTax>): InvoiceTax {
  return stored as InvoiceTax
}
