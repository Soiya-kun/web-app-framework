import type { CustomerRepository } from '../../domain/customer/customerRepository'
import { restoreCustomer } from '../../domain/customer/entity'
import { NotFoundError } from '../../domain/shared/error'
import type { MemoryDatabase } from './memoryDatabase'

export function prepareCustomerMemoryRepository(database: MemoryDatabase): CustomerRepository {
  return {
    async findCustomer(customerId) {
      const row = database.customer.find((customerRow) => customerRow.customerId === customerId)
      if (row === undefined) {
        throw new NotFoundError('missingTarget')
      }
      return restoreCustomer(row)
    },
    async listCustomers() {
      return database.customer
        .toSorted((left, right) => left.customerId.localeCompare(right.customerId))
        .map(restoreCustomer)
    },
  }
}
