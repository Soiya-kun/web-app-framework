import { defineFlow, operate, outside } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { createCustomer } from '../../scenario/customer/createCustomer'
import { createSales } from '../../scenario/sales/createSales'

export const customerCreation = defineFlow<Partial<MemoryDatabase>>('customerCreation', {
  precondition: { summary: '取引を始める顧客の請求先・締日・回収条件が決まっている', seed: {} },
  steps: [
    operate(createCustomer),
    outside('salesperson', 'deliverProduct'),
    operate(createSales, { customer: '株式会社新', salesDate: '2026-10-15', salesKind: '通常', itemName: '運賃', salesAmount: '100000', taxRate: '10%' }),
  ],
})
