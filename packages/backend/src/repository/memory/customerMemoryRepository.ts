import type { CustomerRepository } from '../../domain/customer/customerRepository'
import { restoreCustomer } from '../../domain/customer/entity'
import type { CustomerId } from '../../domain/customer/value/customerId'
import { NotFoundError } from '../../domain/shared/error'
import type { MemoryDatabase } from './memoryDatabase'

export function prepareCustomerMemoryRepository(database: MemoryDatabase): CustomerRepository {
  async function findCustomer(customerId: CustomerId) {
    const row = database.customer.find((customerRow) => customerRow.customerId === customerId)
    if (row === undefined) {
      throw new NotFoundError('missingTarget')
    }
    return restoreCustomer(row)
  }
  return {
    findCustomer,
    // モック DB は同時に動かないので、ロックは取得と同じ。
    lockCustomer: findCustomer,
    async listCustomers() {
      return database.customer
        .toSorted((left, right) => left.customerId.localeCompare(right.customerId))
        .map(restoreCustomer)
    },
  }
}
