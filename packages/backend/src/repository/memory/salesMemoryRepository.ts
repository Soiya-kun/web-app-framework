import type { SalesRepository } from '../../domain/sales/salesRepository'
import { ConflictError } from '../../domain/shared/error'
import type { MemoryDatabase } from './memoryDatabase'

export function prepareSalesMemoryRepository(database: MemoryDatabase): SalesRepository {
  return {
    async createSales(salesCreate) {
      // 本物の DB の主キー制約と同じく、同じ ID の行は保存しない。
      if (database.sales.some((row) => row.salesId === salesCreate.salesId)) {
        throw new ConflictError('duplicateTarget')
      }
      database.sales.push({ ...salesCreate })
    },
  }
}
