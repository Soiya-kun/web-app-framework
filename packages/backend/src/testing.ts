// 画面の結合テスト用の部品。DB だけをモック DB に差し替え、ほかは本物のコードを動かす。
import type { AppDependency } from './handler/dependency'
import { prepareCustomerMemoryRepository } from './repository/memory/customerMemoryRepository'
import type { MemoryDatabase } from './repository/memory/memoryDatabase'
import { prepareSalesMemoryRepository } from './repository/memory/salesMemoryRepository'
import { prepareSequenceIdGenerator } from './repository/sequenceIdGenerator'

export { prepareMemoryDatabase, type MemoryDatabase } from './repository/memory/memoryDatabase'
export type { CustomerRow, SalesRow } from './repository/table'

export function prepareMemoryDependency(database: MemoryDatabase): AppDependency {
  return {
    customerRepository: prepareCustomerMemoryRepository(database),
    salesRepository: prepareSalesMemoryRepository(database),
    idGenerator: prepareSequenceIdGenerator(),
  }
}
