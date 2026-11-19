import type { CustomerRepository } from '../../domain/customer/customerRepository'
import type { Customer } from '../../domain/customer/entity'

export async function listCustomers(customerRepository: CustomerRepository): Promise<readonly Customer[]> {
  const customers = await customerRepository.listCustomers()
  return customers
}
