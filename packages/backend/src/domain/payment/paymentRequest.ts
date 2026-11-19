import { interpretCustomerId, type CustomerId } from '../customer/value/customerId'
import { interpretFields } from '../shared/validation'
import type { Yen } from '../shared/yen'
import { interpretPayerName, type PayerName } from './value/payerName'
import { interpretPaymentAmount } from './value/paymentAmount'
import { interpretPaymentDate, type PaymentDate } from './value/paymentDate'
import { interpretPaymentMethod, type PaymentMethod } from './value/paymentMethod'

/** 画面から届いた入金の入力。customerId が空なら、振込依頼人名から顧客を特定する。値はまだ検証していない。 */
export type PaymentRequest = {
  readonly paymentDate: string
  readonly paymentMethod: string
  readonly paymentAmount: string
  readonly payerName: string
  readonly customerId: string
}

export type PaymentInput = {
  readonly paymentDate: PaymentDate
  readonly paymentMethod: PaymentMethod
  readonly paymentAmount: Yen
  readonly payerName: PayerName
  /** 画面で選んだ顧客。null は選んでいない（振込依頼人名から特定する）。 */
  readonly customerId: CustomerId | null
}

export function interpretPaymentRequest(paymentRequest: PaymentRequest): PaymentInput {
  return interpretFields({
    paymentDate: () => interpretPaymentDate(paymentRequest.paymentDate),
    paymentMethod: () => interpretPaymentMethod(paymentRequest.paymentMethod),
    paymentAmount: () => interpretPaymentAmount(paymentRequest.paymentAmount),
    payerName: () => interpretPayerName(paymentRequest.payerName),
    customerId: () => (paymentRequest.customerId === '' ? null : interpretCustomerId(paymentRequest.customerId)),
  })
}
