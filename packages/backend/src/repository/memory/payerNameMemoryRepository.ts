import { restoreCustomer } from '../../domain/customer/entity'
import type { PayerNameRepository } from '../../domain/payerName/payerNameRepository'
import type { MemoryDatabase } from './memoryDatabase'

export function preparePayerNameMemoryRepository(database: MemoryDatabase): PayerNameRepository {
  return {
    async findPayerCustomer(payerName) {
      const entry = database.payerName.find((row) => row.payerName === payerName)
      const customer = database.customer.find((row) => row.customerId === entry?.customerId)
      return customer === undefined ? undefined : restoreCustomer(customer)
    },
    async savePayerNames(payerNameSaves) {
      // 本物の DB の「同じ名前なら顧客を上書き」と同じ。
      for (const payerNameSave of payerNameSaves) {
        const index = database.payerName.findIndex((row) => row.payerName === payerNameSave.payerName)
        if (index === -1) {
          database.payerName.push({ ...payerNameSave })
        } else {
          database.payerName[index] = { ...payerNameSave }
        }
      }
    },
  }
}
