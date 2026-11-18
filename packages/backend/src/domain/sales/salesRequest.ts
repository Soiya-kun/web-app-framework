import { interpretCustomerId, type CustomerId } from '../customer/value/customerId'
import { interpretFields } from '../shared/validation'
import { interpretSalesAmount, type SalesAmount } from './value/salesAmount'
import { interpretSalesDate, type SalesDate } from './value/salesDate'

/** 画面から届いた売上の入力。値はまだ検証していない。 */
export type SalesRequest = {
  readonly customerId: string
  readonly salesDate: string
  readonly salesAmount: string
}

/** 売上の入力を、検証済みの値にしたもの。 */
export type SalesInput = {
  readonly customerId: CustomerId
  readonly salesDate: SalesDate
  readonly salesAmount: SalesAmount
}

/** 画面の入力を、売上として扱える値にそろえるため。 */
export function interpretSalesRequest(salesRequest: SalesRequest): SalesInput {
  return interpretFields({
    customerId: () => interpretCustomerId(salesRequest.customerId),
    salesDate: () => interpretSalesDate(salesRequest.salesDate),
    salesAmount: () => interpretSalesAmount(salesRequest.salesAmount),
  })
}
