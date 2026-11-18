import type { CustomerRepository } from '../../domain/customer/customerRepository'
import type { Customer } from '../../domain/customer/entity'

/** 売上の登録で選べる顧客を示すため。 */
export async function listCustomers(customerRepository: CustomerRepository): Promise<readonly Customer[]> {
  const customers = await customerRepository.listCustomers()
  return customers
}
