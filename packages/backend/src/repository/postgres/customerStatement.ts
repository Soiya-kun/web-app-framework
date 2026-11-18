import type { Customer } from '../../domain/customer/entity'
import type { Stored } from '../../domain/shared/brand'
import { defineStatement } from './statement'

export const findCustomerStatement = defineStatement<[customerId: string], Stored<Customer>>(
  'findCustomer',
  `
SELECT customer_id AS "customerId",
       customer_name AS "customerName",
       billing_customer_id AS "billingCustomerId",
       closing_day AS "closingDay",
       collection_month_offset AS "collectionMonthOffset",
       collection_day AS "collectionDay"
FROM customer
WHERE customer_id = $1
`,
)

export const listCustomersStatement = defineStatement<[], Stored<Customer>>(
  'listCustomers',
  `
SELECT customer_id AS "customerId",
       customer_name AS "customerName",
       billing_customer_id AS "billingCustomerId",
       closing_day AS "closingDay",
       collection_month_offset AS "collectionMonthOffset",
       collection_day AS "collectionDay"
FROM customer
ORDER BY customer_id
`,
)
