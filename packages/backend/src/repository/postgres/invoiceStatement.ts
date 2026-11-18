import type { Adjustment } from '../../domain/adjustment/entity'
import type { Invoice, InvoiceListItem, InvoiceTax } from '../../domain/invoice/entity'
import type { Payment } from '../../domain/payment/entity'
import type { Refund } from '../../domain/refund/entity'
import type { Sales } from '../../domain/sales/entity'
import type { Stored } from '../../domain/shared/brand'
import { defineStatement } from './statement'

// 請求の取得

export const findInvoiceStatement = defineStatement<[invoiceId: string], Stored<Invoice>>(
  'findInvoice',
  `
SELECT invoice_id AS "invoiceId", billing_customer_id AS "billingCustomerId", previous_invoice_id AS "previousInvoiceId",
       closing_date AS "closingDate", due_date AS "dueDate",
       previous_amount AS "previousAmount", payment_amount AS "paymentAmount", adjustment_amount AS "adjustmentAmount",
       carried_amount AS "carriedAmount", sales_amount AS "salesAmount", tax_amount AS "taxAmount", invoice_amount AS "invoiceAmount",
       invoice_number AS "invoiceNumber", issue_date AS "issueDate"
FROM invoice
WHERE invoice_id = $1
`,
)

export const findLatestInvoiceStatement = defineStatement<[billingCustomerId: string], Stored<Invoice>>(
  'findLatestInvoice',
  `
SELECT invoice_id AS "invoiceId", billing_customer_id AS "billingCustomerId", previous_invoice_id AS "previousInvoiceId",
       closing_date AS "closingDate", due_date AS "dueDate",
       previous_amount AS "previousAmount", payment_amount AS "paymentAmount", adjustment_amount AS "adjustmentAmount",
       carried_amount AS "carriedAmount", sales_amount AS "salesAmount", tax_amount AS "taxAmount", invoice_amount AS "invoiceAmount",
       invoice_number AS "invoiceNumber", issue_date AS "issueDate"
FROM invoice
WHERE billing_customer_id = $1
ORDER BY closing_date DESC
LIMIT 1
`,
)

export const listInvoicesStatement = defineStatement<[], Stored<InvoiceListItem>>(
  'listInvoices',
  `
SELECT i.invoice_id AS "invoiceId", i.billing_customer_id AS "billingCustomerId", i.previous_invoice_id AS "previousInvoiceId",
       i.closing_date AS "closingDate", i.due_date AS "dueDate",
       i.previous_amount AS "previousAmount", i.payment_amount AS "paymentAmount", i.adjustment_amount AS "adjustmentAmount",
       i.carried_amount AS "carriedAmount", i.sales_amount AS "salesAmount", i.tax_amount AS "taxAmount", i.invoice_amount AS "invoiceAmount",
       i.invoice_number AS "invoiceNumber", i.issue_date AS "issueDate",
       c.customer_name AS "billingCustomerName"
FROM invoice i
JOIN customer c ON c.customer_id = i.billing_customer_id
ORDER BY i.closing_date DESC, i.billing_customer_id
`,
)

export const findInvoiceListItemStatement = defineStatement<[invoiceId: string], Stored<InvoiceListItem>>(
  'findInvoiceListItem',
  `
SELECT i.invoice_id AS "invoiceId", i.billing_customer_id AS "billingCustomerId", i.previous_invoice_id AS "previousInvoiceId",
       i.closing_date AS "closingDate", i.due_date AS "dueDate",
       i.previous_amount AS "previousAmount", i.payment_amount AS "paymentAmount", i.adjustment_amount AS "adjustmentAmount",
       i.carried_amount AS "carriedAmount", i.sales_amount AS "salesAmount", i.tax_amount AS "taxAmount", i.invoice_amount AS "invoiceAmount",
       i.invoice_number AS "invoiceNumber", i.issue_date AS "issueDate",
       c.customer_name AS "billingCustomerName"
FROM invoice i
JOIN customer c ON c.customer_id = i.billing_customer_id
WHERE i.invoice_id = $1
`,
)

// 請求に載せた行

export const listInvoiceTaxesStatement = defineStatement<[invoiceId: string], Stored<InvoiceTax>>(
  'listInvoiceTaxes',
  `
SELECT invoice_id AS "invoiceId", tax_rate AS "taxRate", taxable_amount AS "taxableAmount", tax_amount AS "taxAmount"
FROM invoice_tax
WHERE invoice_id = $1
ORDER BY tax_rate DESC
`,
)

export const listInvoiceSalesStatement = defineStatement<[invoiceId: string], Stored<Sales>>(
  'listInvoiceSales',
  `
SELECT sales_id AS "salesId", customer_id AS "customerId", sales_date AS "salesDate", sales_kind AS "salesKind",
       item_name AS "itemName", sales_amount AS "salesAmount", tax_rate AS "taxRate", invoice_id AS "invoiceId"
FROM sales
WHERE invoice_id = $1
ORDER BY sales_date, sales_id
`,
)

export const listInvoicePaymentsStatement = defineStatement<[invoiceId: string], Stored<Payment>>(
  'listInvoicePayments',
  `
SELECT payment_id AS "paymentId", payment_date AS "paymentDate", payment_method AS "paymentMethod",
       payment_amount AS "paymentAmount", payer_name AS "payerName", customer_id AS "customerId", invoice_id AS "invoiceId"
FROM payment
WHERE invoice_id = $1
ORDER BY payment_date, payment_id
`,
)

export const listInvoiceRefundsStatement = defineStatement<[invoiceId: string], Stored<Refund>>(
  'listInvoiceRefunds',
  `
SELECT refund_id AS "refundId", payment_id AS "paymentId", refund_date AS "refundDate",
       refund_amount AS "refundAmount", invoice_id AS "invoiceId"
FROM refund
WHERE invoice_id = $1
ORDER BY refund_date, refund_id
`,
)

export const listInvoiceAdjustmentsStatement = defineStatement<[invoiceId: string], Stored<Adjustment>>(
  'listInvoiceAdjustments',
  `
SELECT adjustment_id AS "adjustmentId", billing_customer_id AS "billingCustomerId", adjustment_date AS "adjustmentDate",
       adjustment_kind AS "adjustmentKind", adjustment_amount AS "adjustmentAmount", payment_id AS "paymentId", invoice_id AS "invoiceId"
FROM adjustment
WHERE invoice_id = $1
ORDER BY adjustment_date, adjustment_id
`,
)

// 締め: 請求締め日までの、まだ請求に載せていない行を、締めが終わるまでロックして読む

export const listUnbilledSalesStatement = defineStatement<[billingCustomerId: string, closingDate: string], Stored<Sales>>(
  'listUnbilledSales',
  `
SELECT s.sales_id AS "salesId", s.customer_id AS "customerId", s.sales_date AS "salesDate", s.sales_kind AS "salesKind",
       s.item_name AS "itemName", s.sales_amount AS "salesAmount", s.tax_rate AS "taxRate", s.invoice_id AS "invoiceId"
FROM sales s
JOIN customer c ON c.customer_id = s.customer_id
WHERE c.billing_customer_id = $1
  AND s.invoice_id IS NULL
  AND s.sales_date <= $2
ORDER BY s.sales_date, s.sales_id
FOR UPDATE OF s
`,
)

export const listUnbilledPaymentsStatement = defineStatement<[billingCustomerId: string, closingDate: string], Stored<Payment>>(
  'listUnbilledPayments',
  `
SELECT payment_id AS "paymentId", payment_date AS "paymentDate", payment_method AS "paymentMethod",
       payment_amount AS "paymentAmount", payer_name AS "payerName", customer_id AS "customerId", invoice_id AS "invoiceId"
FROM payment
WHERE customer_id = $1
  AND invoice_id IS NULL
  AND payment_date <= $2
ORDER BY payment_date, payment_id
FOR UPDATE
`,
)

export const listUnbilledRefundsStatement = defineStatement<[billingCustomerId: string, closingDate: string], Stored<Refund>>(
  'listUnbilledRefunds',
  `
SELECT r.refund_id AS "refundId", r.payment_id AS "paymentId", r.refund_date AS "refundDate",
       r.refund_amount AS "refundAmount", r.invoice_id AS "invoiceId"
FROM refund r
JOIN payment p ON p.payment_id = r.payment_id
WHERE p.customer_id = $1
  AND r.invoice_id IS NULL
  AND r.refund_date <= $2
ORDER BY r.refund_date, r.refund_id
FOR UPDATE OF r
`,
)

export const listUnbilledAdjustmentsStatement = defineStatement<
  [billingCustomerId: string, closingDate: string],
  Stored<Adjustment>
>(
  'listUnbilledAdjustments',
  `
SELECT adjustment_id AS "adjustmentId", billing_customer_id AS "billingCustomerId", adjustment_date AS "adjustmentDate",
       adjustment_kind AS "adjustmentKind", adjustment_amount AS "adjustmentAmount", payment_id AS "paymentId", invoice_id AS "invoiceId"
FROM adjustment
WHERE billing_customer_id = $1
  AND invoice_id IS NULL
  AND adjustment_date <= $2
ORDER BY adjustment_date, adjustment_id
FOR UPDATE
`,
)

// 締め: 請求を保存し、行を請求に載せる

export const createInvoiceStatement = defineStatement<
  [
    invoiceId: string,
    billingCustomerId: string,
    previousInvoiceId: string | null,
    closingDate: string,
    dueDate: string,
    previousAmount: number,
    paymentAmount: number,
    adjustmentAmount: number,
    carriedAmount: number,
    salesAmount: number,
    taxAmount: number,
    invoiceAmount: number,
  ]
>(
  'createInvoice',
  `
INSERT INTO invoice (
  invoice_id, billing_customer_id, previous_invoice_id, closing_date, due_date,
  previous_amount, payment_amount, adjustment_amount, carried_amount, sales_amount, tax_amount, invoice_amount
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
`,
)

export const createInvoiceTaxesStatement = defineStatement<
  [invoiceId: string, taxRates: readonly number[], taxableAmounts: readonly number[], taxAmounts: readonly number[]]
>(
  'createInvoiceTaxes',
  `
INSERT INTO invoice_tax (invoice_id, tax_rate, taxable_amount, tax_amount)
SELECT $1, tax.tax_rate, tax.taxable_amount, tax.tax_amount
FROM unnest($2::smallint[], $3::bigint[], $4::bigint[]) AS tax (tax_rate, taxable_amount, tax_amount)
`,
)

export const billSalesStatement = defineStatement<[invoiceId: string, salesIds: readonly string[]], { readonly salesId: string }>(
  'billSales',
  `
UPDATE sales SET invoice_id = $1
WHERE sales_id = ANY ($2::text[]) AND invoice_id IS NULL
RETURNING sales_id AS "salesId"
`,
)

export const billPaymentsStatement = defineStatement<
  [invoiceId: string, paymentIds: readonly string[]],
  { readonly paymentId: string }
>(
  'billPayments',
  `
UPDATE payment SET invoice_id = $1
WHERE payment_id = ANY ($2::text[]) AND invoice_id IS NULL
RETURNING payment_id AS "paymentId"
`,
)

export const billRefundsStatement = defineStatement<[invoiceId: string, refundIds: readonly string[]], { readonly refundId: string }>(
  'billRefunds',
  `
UPDATE refund SET invoice_id = $1
WHERE refund_id = ANY ($2::text[]) AND invoice_id IS NULL
RETURNING refund_id AS "refundId"
`,
)

export const billAdjustmentsStatement = defineStatement<
  [invoiceId: string, adjustmentIds: readonly string[]],
  { readonly adjustmentId: string }
>(
  'billAdjustments',
  `
UPDATE adjustment SET invoice_id = $1
WHERE adjustment_id = ANY ($2::text[]) AND invoice_id IS NULL
RETURNING adjustment_id AS "adjustmentId"
`,
)

// 発行

export const takeInvoiceNumberStatement = defineStatement<[issueYear: number], { readonly lastNumber: number }>(
  'takeInvoiceNumber',
  `
INSERT INTO invoice_counter (issue_year, last_number)
VALUES ($1, 1)
ON CONFLICT (issue_year) DO UPDATE SET last_number = invoice_counter.last_number + 1
RETURNING last_number AS "lastNumber"
`,
)

export const issueInvoiceStatement = defineStatement<
  [invoiceId: string, invoiceNumber: string, issueDate: string],
  { readonly invoiceId: string }
>(
  'issueInvoice',
  `
UPDATE invoice SET invoice_number = $2, issue_date = $3
WHERE invoice_id = $1 AND issue_date IS NULL
RETURNING invoice_id AS "invoiceId"
`,
)

// 締めの取消: 載せた行を戻し、発行前の請求を消す

export const unbillSalesStatement = defineStatement<[invoiceId: string]>(
  'unbillSales',
  `
UPDATE sales SET invoice_id = NULL WHERE invoice_id = $1
`,
)

export const unbillPaymentsStatement = defineStatement<[invoiceId: string]>(
  'unbillPayments',
  `
UPDATE payment SET invoice_id = NULL WHERE invoice_id = $1
`,
)

export const unbillRefundsStatement = defineStatement<[invoiceId: string]>(
  'unbillRefunds',
  `
UPDATE refund SET invoice_id = NULL WHERE invoice_id = $1
`,
)

export const unbillAdjustmentsStatement = defineStatement<[invoiceId: string]>(
  'unbillAdjustments',
  `
UPDATE adjustment SET invoice_id = NULL WHERE invoice_id = $1
`,
)

export const deleteInvoiceTaxesStatement = defineStatement<[invoiceId: string]>(
  'deleteInvoiceTaxes',
  `
DELETE FROM invoice_tax WHERE invoice_id = $1
`,
)

export const deleteInvoiceStatement = defineStatement<[invoiceId: string], { readonly invoiceId: string }>(
  'deleteInvoice',
  `
DELETE FROM invoice
WHERE invoice_id = $1 AND issue_date IS NULL
RETURNING invoice_id AS "invoiceId"
`,
)
