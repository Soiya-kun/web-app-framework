import { prepareMemoryDatabase } from '../../src/repository/memory/memoryDatabase'
import { prepareMemoryRepositories, prepareMemoryTransaction } from '../../src/repository/memory/memoryTransaction'
import { describeRepositoryContract } from './repositoryContract'

describeRepositoryContract('モック DB', async () => {
  const database = prepareMemoryDatabase()
  return {
    repositories: prepareMemoryRepositories(database),
    runTransaction: prepareMemoryTransaction(database),
    async seedTables(seed) {
      database.customer.push(...(seed.customer ?? []))
      database.payerName.push(...(seed.payerName ?? []))
      database.invoice.push(...(seed.invoice ?? []))
      database.invoiceTax.push(...(seed.invoiceTax ?? []))
      database.invoiceCounter.push(...(seed.invoiceCounter ?? []))
      database.sales.push(...(seed.sales ?? []))
      database.payment.push(...(seed.payment ?? []))
      database.refund.push(...(seed.refund ?? []))
      database.adjustment.push(...(seed.adjustment ?? []))
    },
    async readTables() {
      return prepareMemoryDatabase(database)
    },
  }
})
