import { prepareMemoryDatabase } from '../../src/repository/memory/memoryDatabase'
import { prepareMemoryRepositories, prepareMemoryTransaction } from '../../src/repository/memory/memoryTransaction'
import { describeRepositoryContract } from './repositoryContract'

describeRepositoryContract('モック DB', async () => {
  const database = prepareMemoryDatabase()
  return {
    repositories: prepareMemoryRepositories(database),
    runTransaction: prepareMemoryTransaction(database),
    async seedCustomers(customers) {
      database.customer.push(...customers)
    },
    async readSales() {
      return database.sales
    },
  }
})
