import type { Customer } from '../../domain/customer/entity'
import type { Stored } from '../../domain/shared/brand'
import { defineStatement } from './statement'

export const findPayerCustomerStatement = defineStatement<[payerName: string], Stored<Customer>>(
  'findPayerCustomer',
  `
SELECT c.customer_id AS "customerId",
       c.customer_name AS "customerName",
       c.billing_customer_id AS "billingCustomerId",
       c.closing_day AS "closingDay",
       c.collection_month_offset AS "collectionMonthOffset",
       c.collection_day AS "collectionDay"
FROM payer_name n
JOIN customer c ON c.customer_id = n.customer_id
WHERE n.payer_name = $1
`,
)

export const savePayerNamesStatement = defineStatement<[payerNames: readonly string[], customerIds: readonly string[]]>(
  'savePayerNames',
  `
INSERT INTO payer_name (payer_name, customer_id)
SELECT entry.payer_name, entry.customer_id
FROM unnest($1::text[], $2::text[]) AS entry (payer_name, customer_id)
ON CONFLICT (payer_name) DO UPDATE SET customer_id = EXCLUDED.customer_id
`,
)
