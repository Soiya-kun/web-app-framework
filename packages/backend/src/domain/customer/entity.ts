import type { Stored } from '../shared/brand'
import type { CustomerId } from './value/customerId'
import type { CustomerName } from './value/customerName'
import type { MonthDay } from './value/monthDay'
import type { MonthOffset } from './value/monthOffset'

/**
 * 売上を計上する相手（得意先）。請求先は自分自身か、ほかの顧客（親会社など）。
 * 締日・回収条件は、請求先として使うときだけ意味を持つ。項目は customer テーブルの列と同じ。
 */
export type Customer = {
  readonly customerId: CustomerId
  readonly customerName: CustomerName
  readonly billingCustomerId: CustomerId
  readonly closingDay: MonthDay
  readonly collectionMonthOffset: MonthOffset
  readonly collectionDay: MonthDay
}

export function restoreCustomer(stored: Stored<Customer>): Customer {
  return stored as Customer
}
