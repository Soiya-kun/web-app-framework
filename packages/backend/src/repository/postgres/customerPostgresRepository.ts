import type { CustomerRepository } from '../../domain/customer/customerRepository'
import { restoreCustomer } from '../../domain/customer/entity'
import { NotFoundError } from '../../domain/shared/error'
import { findCustomerStatement, listCustomersStatement, lockCustomerStatement } from './customerStatement'
import type { Executor } from './statement'

export function prepareCustomerPostgresRepository(executor: Executor): CustomerRepository {
  return {
    async findCustomer(customerId) {
      const [row] = await executor.execute(findCustomerStatement, [customerId])
      if (row === undefined) {
        throw new NotFoundError('missingTarget')
      }
      return restoreCustomer(row)
    },
    async lockCustomer(customerId) {
      const [row] = await executor.execute(lockCustomerStatement, [customerId])
      if (row === undefined) {
        throw new NotFoundError('missingTarget')
      }
      return restoreCustomer(row)
    },
    async findSelectedCustomer(customerId) {
      if (customerId === null) {
        return undefined
      }
      const [row] = await executor.execute(findCustomerStatement, [customerId])
      if (row === undefined) {
        throw new NotFoundError('missingTarget')
      }
      return restoreCustomer(row)
    },
    async listCustomers() {
      const rows = await executor.execute(listCustomersStatement, [])
      return rows.map(restoreCustomer)
    },
  }
}
