import { restoreCustomer } from '../../domain/customer/entity'
import type { PayerNameRepository } from '../../domain/payerName/payerNameRepository'
import { findPayerCustomerStatement, savePayerNamesStatement } from './payerNameStatement'
import type { Executor } from './statement'

export function preparePayerNamePostgresRepository(executor: Executor): PayerNameRepository {
  return {
    async findPayerCustomer(payerName) {
      const [row] = await executor.execute(findPayerCustomerStatement, [payerName])
      return row === undefined ? undefined : restoreCustomer(row)
    },
    async savePayerNames(payerNameSaves) {
      await executor.execute(savePayerNamesStatement, [
        payerNameSaves.map((payerNameSave) => payerNameSave.payerName),
        payerNameSaves.map((payerNameSave) => payerNameSave.customerId),
      ])
    },
  }
}
