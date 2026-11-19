import type { Customer } from './entity'
import type { CustomerId } from './value/customerId'

export type CustomerRepository = {
  /** 見つからなければ NotFoundError にする。 */
  findCustomer(customerId: CustomerId): Promise<Customer>
  /** 見つからなければ NotFoundError にする。トランザクションが終わるまで、同じ顧客の締めなどを待たせる。 */
  lockCustomer(customerId: CustomerId): Promise<Customer>
  /** 画面で選んだ顧客。customerId が null（選んでいない）なら undefined。選んだ顧客がなければ NotFoundError にする。 */
  findSelectedCustomer(customerId: CustomerId | null): Promise<Customer | undefined>
  listCustomers(): Promise<readonly Customer[]>
}
