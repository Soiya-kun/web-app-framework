# SQL の台帳

> 生成物。`pnpm sql:ledger` で packages/backend/src/repository/postgres の defineStatement から作る。手で編集しない。
> repository が実行する SQL は、ここにあるものだけ（Executor は defineStatement で定義した SQL しか受け付けない）。

SQL の数: 34

## findCustomer

[packages/backend/src/repository/postgres/customerStatement.ts:5](../../packages/backend/src/repository/postgres/customerStatement.ts#L5)

```sql
SELECT customer_id AS "customerId",
       customer_name AS "customerName",
       billing_customer_id AS "billingCustomerId",
       closing_day AS "closingDay",
       collection_month_offset AS "collectionMonthOffset",
       collection_day AS "collectionDay"
FROM customer
WHERE customer_id = $1
```

## listCustomers

[packages/backend/src/repository/postgres/customerStatement.ts:19](../../packages/backend/src/repository/postgres/customerStatement.ts#L19)

```sql
SELECT customer_id AS "customerId",
       customer_name AS "customerName",
       billing_customer_id AS "billingCustomerId",
       closing_day AS "closingDay",
       collection_month_offset AS "collectionMonthOffset",
       collection_day AS "collectionDay"
FROM customer
ORDER BY customer_id
```

## lockCustomer

[packages/backend/src/repository/postgres/customerStatement.ts:33](../../packages/backend/src/repository/postgres/customerStatement.ts#L33)

```sql
SELECT customer_id AS "customerId",
       customer_name AS "customerName",
       billing_customer_id AS "billingCustomerId",
       closing_day AS "closingDay",
       collection_month_offset AS "collectionMonthOffset",
       collection_day AS "collectionDay"
FROM customer
WHERE customer_id = $1
FOR UPDATE
```

## findInvoice

[packages/backend/src/repository/postgres/invoiceStatement.ts:11](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L11)

```sql
SELECT invoice_id AS "invoiceId", billing_customer_id AS "billingCustomerId", previous_invoice_id AS "previousInvoiceId",
       closing_date AS "closingDate", due_date AS "dueDate",
       previous_amount AS "previousAmount", payment_amount AS "paymentAmount", adjustment_amount AS "adjustmentAmount",
       carried_amount AS "carriedAmount", sales_amount AS "salesAmount", tax_amount AS "taxAmount", invoice_amount AS "invoiceAmount",
       invoice_number AS "invoiceNumber", issue_date AS "issueDate"
FROM invoice
WHERE invoice_id = $1
```

## findLatestInvoice

[packages/backend/src/repository/postgres/invoiceStatement.ts:24](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L24)

```sql
SELECT invoice_id AS "invoiceId", billing_customer_id AS "billingCustomerId", previous_invoice_id AS "previousInvoiceId",
       closing_date AS "closingDate", due_date AS "dueDate",
       previous_amount AS "previousAmount", payment_amount AS "paymentAmount", adjustment_amount AS "adjustmentAmount",
       carried_amount AS "carriedAmount", sales_amount AS "salesAmount", tax_amount AS "taxAmount", invoice_amount AS "invoiceAmount",
       invoice_number AS "invoiceNumber", issue_date AS "issueDate"
FROM invoice
WHERE billing_customer_id = $1
ORDER BY closing_date DESC
LIMIT 1
```

## listInvoices

[packages/backend/src/repository/postgres/invoiceStatement.ts:39](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L39)

```sql
SELECT i.invoice_id AS "invoiceId", i.billing_customer_id AS "billingCustomerId", i.previous_invoice_id AS "previousInvoiceId",
       i.closing_date AS "closingDate", i.due_date AS "dueDate",
       i.previous_amount AS "previousAmount", i.payment_amount AS "paymentAmount", i.adjustment_amount AS "adjustmentAmount",
       i.carried_amount AS "carriedAmount", i.sales_amount AS "salesAmount", i.tax_amount AS "taxAmount", i.invoice_amount AS "invoiceAmount",
       i.invoice_number AS "invoiceNumber", i.issue_date AS "issueDate",
       c.customer_name AS "billingCustomerName"
FROM invoice i
JOIN customer c ON c.customer_id = i.billing_customer_id
ORDER BY i.closing_date DESC, i.billing_customer_id
```

## findInvoiceListItem

[packages/backend/src/repository/postgres/invoiceStatement.ts:54](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L54)

```sql
SELECT i.invoice_id AS "invoiceId", i.billing_customer_id AS "billingCustomerId", i.previous_invoice_id AS "previousInvoiceId",
       i.closing_date AS "closingDate", i.due_date AS "dueDate",
       i.previous_amount AS "previousAmount", i.payment_amount AS "paymentAmount", i.adjustment_amount AS "adjustmentAmount",
       i.carried_amount AS "carriedAmount", i.sales_amount AS "salesAmount", i.tax_amount AS "taxAmount", i.invoice_amount AS "invoiceAmount",
       i.invoice_number AS "invoiceNumber", i.issue_date AS "issueDate",
       c.customer_name AS "billingCustomerName"
FROM invoice i
JOIN customer c ON c.customer_id = i.billing_customer_id
WHERE i.invoice_id = $1
```

## listInvoiceTaxes

[packages/backend/src/repository/postgres/invoiceStatement.ts:71](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L71)

```sql
SELECT invoice_id AS "invoiceId", tax_rate AS "taxRate", taxable_amount AS "taxableAmount", tax_amount AS "taxAmount"
FROM invoice_tax
WHERE invoice_id = $1
ORDER BY tax_rate DESC
```

## listInvoiceSales

[packages/backend/src/repository/postgres/invoiceStatement.ts:81](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L81)

```sql
SELECT sales_id AS "salesId", customer_id AS "customerId", sales_date AS "salesDate", sales_kind AS "salesKind",
       item_name AS "itemName", sales_amount AS "salesAmount", tax_rate AS "taxRate", invoice_id AS "invoiceId"
FROM sales
WHERE invoice_id = $1
ORDER BY sales_date, sales_id
```

## listInvoicePayments

[packages/backend/src/repository/postgres/invoiceStatement.ts:92](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L92)

```sql
SELECT payment_id AS "paymentId", payment_date AS "paymentDate", payment_method AS "paymentMethod",
       payment_amount AS "paymentAmount", payer_name AS "payerName", customer_id AS "customerId", invoice_id AS "invoiceId"
FROM payment
WHERE invoice_id = $1
ORDER BY payment_date, payment_id
```

## listInvoiceRefunds

[packages/backend/src/repository/postgres/invoiceStatement.ts:103](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L103)

```sql
SELECT refund_id AS "refundId", payment_id AS "paymentId", refund_date AS "refundDate",
       refund_amount AS "refundAmount", invoice_id AS "invoiceId"
FROM refund
WHERE invoice_id = $1
ORDER BY refund_date, refund_id
```

## listInvoiceAdjustments

[packages/backend/src/repository/postgres/invoiceStatement.ts:114](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L114)

```sql
SELECT adjustment_id AS "adjustmentId", billing_customer_id AS "billingCustomerId", adjustment_date AS "adjustmentDate",
       adjustment_kind AS "adjustmentKind", adjustment_amount AS "adjustmentAmount", payment_id AS "paymentId", invoice_id AS "invoiceId"
FROM adjustment
WHERE invoice_id = $1
ORDER BY adjustment_date, adjustment_id
```

## listUnbilledSales

[packages/backend/src/repository/postgres/invoiceStatement.ts:127](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L127)

```sql
SELECT s.sales_id AS "salesId", s.customer_id AS "customerId", s.sales_date AS "salesDate", s.sales_kind AS "salesKind",
       s.item_name AS "itemName", s.sales_amount AS "salesAmount", s.tax_rate AS "taxRate", s.invoice_id AS "invoiceId"
FROM sales s
JOIN customer c ON c.customer_id = s.customer_id
WHERE c.billing_customer_id = $1
  AND s.invoice_id IS NULL
  AND s.sales_date <= $2
ORDER BY s.sales_date, s.sales_id
FOR UPDATE OF s
```

## listUnbilledPayments

[packages/backend/src/repository/postgres/invoiceStatement.ts:142](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L142)

```sql
SELECT payment_id AS "paymentId", payment_date AS "paymentDate", payment_method AS "paymentMethod",
       payment_amount AS "paymentAmount", payer_name AS "payerName", customer_id AS "customerId", invoice_id AS "invoiceId"
FROM payment
WHERE customer_id = $1
  AND invoice_id IS NULL
  AND payment_date <= $2
ORDER BY payment_date, payment_id
FOR UPDATE
```

## listUnbilledRefunds

[packages/backend/src/repository/postgres/invoiceStatement.ts:156](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L156)

```sql
SELECT r.refund_id AS "refundId", r.payment_id AS "paymentId", r.refund_date AS "refundDate",
       r.refund_amount AS "refundAmount", r.invoice_id AS "invoiceId"
FROM refund r
JOIN payment p ON p.payment_id = r.payment_id
WHERE p.customer_id = $1
  AND r.invoice_id IS NULL
  AND r.refund_date <= $2
ORDER BY r.refund_date, r.refund_id
FOR UPDATE OF r
```

## listUnbilledAdjustments

[packages/backend/src/repository/postgres/invoiceStatement.ts:171](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L171)

```sql
SELECT adjustment_id AS "adjustmentId", billing_customer_id AS "billingCustomerId", adjustment_date AS "adjustmentDate",
       adjustment_kind AS "adjustmentKind", adjustment_amount AS "adjustmentAmount", payment_id AS "paymentId", invoice_id AS "invoiceId"
FROM adjustment
WHERE billing_customer_id = $1
  AND invoice_id IS NULL
  AND adjustment_date <= $2
ORDER BY adjustment_date, adjustment_id
FOR UPDATE
```

## createInvoice

[packages/backend/src/repository/postgres/invoiceStatement.ts:190](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L190)

```sql
INSERT INTO invoice (
  invoice_id, billing_customer_id, previous_invoice_id, closing_date, due_date,
  previous_amount, payment_amount, adjustment_amount, carried_amount, sales_amount, tax_amount, invoice_amount
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
```

## createInvoiceTaxes

[packages/backend/src/repository/postgres/invoiceStatement.ts:216](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L216)

```sql
INSERT INTO invoice_tax (invoice_id, tax_rate, taxable_amount, tax_amount)
SELECT $1, tax.tax_rate, tax.taxable_amount, tax.tax_amount
FROM unnest($2::smallint[], $3::bigint[], $4::bigint[]) AS tax (tax_rate, taxable_amount, tax_amount)
```

## billSales

[packages/backend/src/repository/postgres/invoiceStatement.ts:227](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L227)

```sql
UPDATE sales SET invoice_id = $1
WHERE sales_id = ANY ($2::text[]) AND invoice_id IS NULL
RETURNING sales_id AS "salesId"
```

## billPayments

[packages/backend/src/repository/postgres/invoiceStatement.ts:236](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L236)

```sql
UPDATE payment SET invoice_id = $1
WHERE payment_id = ANY ($2::text[]) AND invoice_id IS NULL
RETURNING payment_id AS "paymentId"
```

## billRefunds

[packages/backend/src/repository/postgres/invoiceStatement.ts:248](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L248)

```sql
UPDATE refund SET invoice_id = $1
WHERE refund_id = ANY ($2::text[]) AND invoice_id IS NULL
RETURNING refund_id AS "refundId"
```

## billAdjustments

[packages/backend/src/repository/postgres/invoiceStatement.ts:257](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L257)

```sql
UPDATE adjustment SET invoice_id = $1
WHERE adjustment_id = ANY ($2::text[]) AND invoice_id IS NULL
RETURNING adjustment_id AS "adjustmentId"
```

## takeInvoiceNumber

[packages/backend/src/repository/postgres/invoiceStatement.ts:271](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L271)

```sql
INSERT INTO invoice_counter (issue_year, last_number)
VALUES ($1, 1)
ON CONFLICT (issue_year) DO UPDATE SET last_number = invoice_counter.last_number + 1
RETURNING last_number AS "lastNumber"
```

## issueInvoice

[packages/backend/src/repository/postgres/invoiceStatement.ts:281](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L281)

```sql
UPDATE invoice SET invoice_number = $2, issue_date = $3
WHERE invoice_id = $1 AND issue_date IS NULL
RETURNING invoice_id AS "invoiceId"
```

## unbillSales

[packages/backend/src/repository/postgres/invoiceStatement.ts:295](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L295)

```sql
UPDATE sales SET invoice_id = NULL WHERE invoice_id = $1
```

## unbillPayments

[packages/backend/src/repository/postgres/invoiceStatement.ts:302](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L302)

```sql
UPDATE payment SET invoice_id = NULL WHERE invoice_id = $1
```

## unbillRefunds

[packages/backend/src/repository/postgres/invoiceStatement.ts:309](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L309)

```sql
UPDATE refund SET invoice_id = NULL WHERE invoice_id = $1
```

## unbillAdjustments

[packages/backend/src/repository/postgres/invoiceStatement.ts:316](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L316)

```sql
UPDATE adjustment SET invoice_id = NULL WHERE invoice_id = $1
```

## deleteInvoiceTaxes

[packages/backend/src/repository/postgres/invoiceStatement.ts:323](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L323)

```sql
DELETE FROM invoice_tax WHERE invoice_id = $1
```

## deleteInvoice

[packages/backend/src/repository/postgres/invoiceStatement.ts:330](../../packages/backend/src/repository/postgres/invoiceStatement.ts#L330)

```sql
DELETE FROM invoice
WHERE invoice_id = $1 AND issue_date IS NULL
RETURNING invoice_id AS "invoiceId"
```

## beginTransaction

[packages/backend/src/repository/postgres/postgresDatabase.ts:8](../../packages/backend/src/repository/postgres/postgresDatabase.ts#L8)

```sql
BEGIN
```

## commitTransaction

[packages/backend/src/repository/postgres/postgresDatabase.ts:9](../../packages/backend/src/repository/postgres/postgresDatabase.ts#L9)

```sql
COMMIT
```

## rollbackTransaction

[packages/backend/src/repository/postgres/postgresDatabase.ts:10](../../packages/backend/src/repository/postgres/postgresDatabase.ts#L10)

```sql
ROLLBACK
```

## createSales

[packages/backend/src/repository/postgres/salesStatement.ts:3](../../packages/backend/src/repository/postgres/salesStatement.ts#L3)

```sql
INSERT INTO sales (sales_id, customer_id, sales_date, sales_kind, item_name, sales_amount, tax_rate)
VALUES ($1, $2, $3, $4, $5, $6, $7)
```
