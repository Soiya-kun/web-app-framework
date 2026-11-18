import type { InvoiceId } from '../invoice/value/invoiceId'
import type { PaymentId } from '../payment/value/paymentId'
import type { Stored } from '../shared/brand'
import type { Yen } from '../shared/yen'
import type { RefundDate } from './value/refundDate'
import type { RefundId } from './value/refundId'

/**
 * 入金の一部か全部を、振込人へ返したこと（過入金・二重入金・他社宛の誤入金）。
 * 請求先の入金の返金は、請求の今回入金額から差し引く。項目は refund テーブルの列と同じ。
 */
export type Refund = {
  readonly refundId: RefundId
  readonly paymentId: PaymentId
  readonly refundDate: RefundDate
  readonly refundAmount: Yen
  readonly invoiceId: InvoiceId | null
}

/** 保存済みの値から返金を組み立てるため。保存済みの値は DB の制約で検証済みとして扱う。 */
export function restoreRefund(stored: Stored<Refund>): Refund {
  return stored as Refund
}
