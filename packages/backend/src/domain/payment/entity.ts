import type { CustomerId } from '../customer/value/customerId'
import type { CustomerName } from '../customer/value/customerName'
import type { InvoiceId } from '../invoice/value/invoiceId'
import type { Stored } from '../shared/brand'
import type { Yen } from '../shared/yen'
import type { PayerName } from './value/payerName'
import type { PaymentDate } from './value/paymentDate'
import type { PaymentId } from './value/paymentId'
import type { PaymentMethod } from './value/paymentMethod'

/**
 * 顧客から受け取ったお金。customerId が null の入金は、振込人を特定できていない入金（仮受）で、請求に載せない。
 * invoiceId は、今回入金額として載せた請求（null はまだ載せていない）。項目は payment テーブルの列と同じ。
 */
export type Payment = {
  readonly paymentId: PaymentId
  readonly paymentDate: PaymentDate
  readonly paymentMethod: PaymentMethod
  readonly paymentAmount: Yen
  readonly payerName: PayerName
  readonly customerId: CustomerId | null
  readonly invoiceId: InvoiceId | null
}

/** 一覧に出す入金。顧客の名前を添える（仮受は null）。 */
export type PaymentListItem = Payment & { readonly customerName: CustomerName | null }

export function restorePayment(stored: Stored<Payment>): Payment {
  return stored as Payment
}

export function restorePaymentListItem(stored: Stored<PaymentListItem>): PaymentListItem {
  return stored as PaymentListItem
}
