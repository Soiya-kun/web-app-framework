import { interpretCustomerId, type CustomerId } from '../customer/value/customerId'
import { interpretFields } from '../shared/validation'
import { interpretItemName, type ItemName } from './value/itemName'
import { interpretSalesAmount, type SalesAmount } from './value/salesAmount'
import { interpretSalesDate, type SalesDate } from './value/salesDate'
import { interpretSalesKind, type SalesKind } from './value/salesKind'
import { interpretTaxRate, type TaxRate } from './value/taxRate'

/** 画面から届いた売上の入力。値はまだ検証していない。 */
export type SalesRequest = {
  readonly customerId: string
  readonly salesDate: string
  readonly salesKind: string
  readonly itemName: string
  readonly salesAmount: string
  readonly taxRate: string
}

/** 売上の入力を、検証済みの値にしたもの。金額は入力のまま正の値。 */
export type SalesInput = {
  readonly customerId: CustomerId
  readonly salesDate: SalesDate
  readonly salesKind: SalesKind
  readonly itemName: ItemName
  readonly salesAmount: SalesAmount
  readonly taxRate: TaxRate
}

/** 画面の入力を、売上として扱える値にそろえるため。 */
export function interpretSalesRequest(salesRequest: SalesRequest): SalesInput {
  return interpretFields({
    customerId: () => interpretCustomerId(salesRequest.customerId),
    salesDate: () => interpretSalesDate(salesRequest.salesDate),
    salesKind: () => interpretSalesKind(salesRequest.salesKind),
    itemName: () => interpretItemName(salesRequest.itemName),
    salesAmount: () => interpretSalesAmount(salesRequest.salesAmount),
    taxRate: () => interpretTaxRate(salesRequest.taxRate),
  })
}
