import type { Payment, PaymentListItem } from './entity'
import type { PaymentCreate } from './paymentCreate'
import type { PaymentIdentify } from './paymentIdentify'
import type { PaymentId } from './value/paymentId'

export type PaymentRepository = {
  createPayment(paymentCreate: PaymentCreate): Promise<void>
  /** 見つからなければ NotFoundError にする。 */
  findPayment(paymentId: PaymentId): Promise<Payment>
  /** 入金日の新しい順。顧客の名前を添える（仮受は null）。 */
  listPayments(): Promise<readonly PaymentListItem[]>
  /** 仮受のままの入金に顧客を入れる。すでに特定されていたら ConflictError にする。 */
  identifyPayment(paymentIdentify: PaymentIdentify): Promise<void>
}
