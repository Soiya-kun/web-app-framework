import { defineStatement } from './statement'

export const createSalesStatement = defineStatement<
  [salesId: string, customerId: string, salesDate: string, salesKind: string, itemName: string, salesAmount: number, taxRate: number]
>(
  'createSales',
  `
INSERT INTO sales (sales_id, customer_id, sales_date, sales_kind, item_name, sales_amount, tax_rate)
VALUES ($1, $2, $3, $4, $5, $6, $7)
`,
)
