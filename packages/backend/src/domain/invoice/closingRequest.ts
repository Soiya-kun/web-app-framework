import { interpretCustomerId, type CustomerId } from '../customer/value/customerId'
import { interpretFields } from '../shared/validation'
import { interpretClosingDate, type ClosingDate } from './value/closingDate'

/** 画面から届いた締めの入力。値はまだ検証していない。 */
export type ClosingRequest = {
  readonly billingCustomerId: string
  readonly closingDate: string
}

export type ClosingInput = {
  readonly billingCustomerId: CustomerId
  readonly closingDate: ClosingDate
}

export function interpretClosingRequest(closingRequest: ClosingRequest): ClosingInput {
  return interpretFields({
    billingCustomerId: () => interpretCustomerId(closingRequest.billingCustomerId),
    closingDate: () => interpretClosingDate(closingRequest.closingDate),
  })
}
