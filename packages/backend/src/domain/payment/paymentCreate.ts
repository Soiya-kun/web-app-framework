import type { CustomerId } from '../customer/value/customerId'
import type { Brand } from '../shared/brand'
import type { Payment } from './entity'
import type { PaymentInput } from './paymentRequest'
import type { PaymentId } from './value/paymentId'

/** 入金の登録で保存する値。この型の項目が、そのまま payment テーブルの1行になる（invoice_id は締めで入れる）。 */
export type PaymentCreate = Brand<Omit<Payment, 'invoiceId'>, 'PaymentCreate'>

/** 検証済みの入力と決めた顧客から、保存する入金を決めるため。 */
export function planPaymentCreate(paymentId: PaymentId, paymentInput: PaymentInput, customerId: CustomerId | null): PaymentCreate {
  return {
    paymentId,
    paymentDate: paymentInput.paymentDate,
    paymentMethod: paymentInput.paymentMethod,
    paymentAmount: paymentInput.paymentAmount,
    payerName: paymentInput.payerName,
    customerId,
  } as PaymentCreate
}
