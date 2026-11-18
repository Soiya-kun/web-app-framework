// 画面の結合テスト用の部品。DB だけをモック DB に差し替え、ほかは本物のコードを動かす。
import type { AppDependency } from './handler/dependency'
import type { MemoryDatabase } from './repository/memory/memoryDatabase'
import { prepareMemoryTransaction } from './repository/memory/memoryTransaction'
import { prepareSequenceIdGenerator } from './repository/sequenceIdGenerator'

export type { Customer } from './domain/customer/entity'
export type { Sales } from './domain/sales/entity'
export type { Stored } from './domain/shared/brand'
export { prepareMemoryDatabase, type MemoryDatabase } from './repository/memory/memoryDatabase'

export function prepareMemoryDependency(database: MemoryDatabase): AppDependency {
  return {
    runTransaction: prepareMemoryTransaction(database),
    idGenerator: prepareSequenceIdGenerator(),
  }
}
