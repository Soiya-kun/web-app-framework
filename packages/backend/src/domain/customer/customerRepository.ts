import type { Customer } from './entity'
import type { CustomerId } from './value/customerId'

export type CustomerRepository = {
  /** 見つからなければ NotFoundError にする。 */
  findCustomer(customerId: CustomerId): Promise<Customer>
  /** 見つからなければ NotFoundError にする。トランザクションが終わるまで、同じ顧客の締めなどを待たせる。 */
  lockCustomer(customerId: CustomerId): Promise<Customer>
  listCustomers(): Promise<readonly Customer[]>
}
