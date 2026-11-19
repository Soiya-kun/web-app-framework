import type { CustomerId } from '../customer/value/customerId'
import type { InvoiceId } from '../invoice/value/invoiceId'
import type { Stored } from '../shared/brand'
import type { ItemName } from './value/itemName'
import type { SalesAmount } from './value/salesAmount'
import type { SalesDate } from './value/salesDate'
import type { SalesId } from './value/salesId'
import type { SalesKind } from './value/salesKind'
import type { TaxRate } from './value/taxRate'

/** 顧客に対して計上した売上。invoiceId は載せた請求（null はまだ載せていない）。項目は sales テーブルの列と同じ。 */
export type Sales = {
  readonly salesId: SalesId
  readonly customerId: CustomerId
  readonly salesDate: SalesDate
  readonly salesKind: SalesKind
  readonly itemName: ItemName
  readonly salesAmount: SalesAmount
  readonly taxRate: TaxRate
  readonly invoiceId: InvoiceId | null
}

export function restoreSales(stored: Stored<Sales>): Sales {
  return stored as Sales
}
