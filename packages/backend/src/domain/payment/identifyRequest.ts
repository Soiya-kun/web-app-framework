import { interpretCustomerId, type CustomerId } from '../customer/value/customerId'
import { interpretFields } from '../shared/validation'
import { interpretPaymentId, type PaymentId } from './value/paymentId'

/** 画面から届いた、仮受の入金の顧客の特定の入力。 */
export type IdentifyRequest = {
  readonly paymentId: string
  readonly customerId: string
}

export type IdentifyInput = {
  readonly paymentId: PaymentId
  readonly customerId: CustomerId
}

/** 画面の入力を、特定に使える値にそろえるため。 */
export function interpretIdentifyRequest(identifyRequest: IdentifyRequest): IdentifyInput {
  return interpretFields({
    paymentId: () => interpretPaymentId(identifyRequest.paymentId),
    customerId: () => interpretCustomerId(identifyRequest.customerId),
  })
}
