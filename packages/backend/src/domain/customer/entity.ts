import type { CustomerId } from './value/customerId'
import type { CustomerName } from './value/customerName'

/** 売上を計上する相手。 */
export type Customer = {
  readonly customerId: CustomerId
  readonly customerName: CustomerName
}

/** 保存済みの値から顧客を組み立てるため。保存済みの値は検証済みとして扱う。 */
export function restoreCustomer(customerId: string, customerName: string): Customer {
  return { customerId: customerId as CustomerId, customerName: customerName as CustomerName }
}
