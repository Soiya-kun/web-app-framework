import type { RepositorySet, RunTransaction } from '../../domain/repositorySet'
import { prepareCustomerMemoryRepository } from './customerMemoryRepository'
import { prepareInvoiceMemoryRepository } from './invoiceMemoryRepository'
import { copyMemoryDatabase, restoreMemoryDatabase, type MemoryDatabase } from './memoryDatabase'
import { prepareSalesMemoryRepository } from './salesMemoryRepository'

export function prepareMemoryRepositories(database: MemoryDatabase): RepositorySet {
  return {
    customerRepository: prepareCustomerMemoryRepository(database),
    salesRepository: prepareSalesMemoryRepository(database),
    invoiceRepository: prepareInvoiceMemoryRepository(database),
  }
}

/** 本物の DB と同じく、処理が例外で終わったら書いた内容を取り消す。 */
export function prepareMemoryTransaction(database: MemoryDatabase): RunTransaction {
  return async (work) => {
    const copy = copyMemoryDatabase(database)
    try {
      return await work(prepareMemoryRepositories(database))
    } catch (error) {
      restoreMemoryDatabase(database, copy)
      throw error
    }
  }
}
