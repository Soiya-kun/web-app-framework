import type { SalesRepository } from '../../domain/sales/salesRepository'
import { createSalesStatement } from './salesStatement'
import type { Executor } from './statement'

export function prepareSalesPostgresRepository(executor: Executor): SalesRepository {
  return {
    async createSales(salesCreate) {
      await executor.execute(createSalesStatement, [
        salesCreate.salesId,
        salesCreate.customerId,
        salesCreate.salesDate,
        salesCreate.salesKind,
        salesCreate.itemName,
        salesCreate.salesAmount,
        salesCreate.taxRate,
      ])
    },
  }
}
