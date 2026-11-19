import type { Customer } from '../customer/entity'
import type { CustomerId } from '../customer/value/customerId'
import type { Brand } from '../shared/brand'
import type { Payment } from './entity'
import type { PaymentId } from './value/paymentId'

/** 仮受の入金の特定で保存する値。payment テーブルの customer_id に入る。対象は仮受のままの行だけ。 */
export type PaymentIdentify = Brand<{ readonly paymentId: PaymentId; readonly customerId: CustomerId }, 'PaymentIdentify'>

export function planPaymentIdentify(payment: Payment, customer: Customer): PaymentIdentify {
  return { paymentId: payment.paymentId, customerId: customer.customerId } as PaymentIdentify
}
