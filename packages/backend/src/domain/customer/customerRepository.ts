import type { Customer } from './entity'
import type { CustomerId } from './value/customerId'

export type CustomerRepository = {
  /** 見つからなければ NotFoundError にする。 */
  findCustomer(customerId: CustomerId): Promise<Customer>
  listCustomers(): Promise<readonly Customer[]>
}
