import type { Payment, PaymentListItem } from '../../domain/payment/entity'
import type { Stored } from '../../domain/shared/brand'
import { defineStatement } from './statement'

export const createPaymentStatement = defineStatement<
  [paymentId: string, paymentDate: string, paymentMethod: string, paymentAmount: number, payerName: string, customerId: string | null]
>(
  'createPayment',
  `
INSERT INTO payment (payment_id, payment_date, payment_method, payment_amount, payer_name, customer_id)
VALUES ($1, $2, $3, $4, $5, $6)
`,
)

export const findPaymentStatement = defineStatement<[paymentId: string], Stored<Payment>>(
  'findPayment',
  `
SELECT payment_id AS "paymentId", payment_date AS "paymentDate", payment_method AS "paymentMethod",
       payment_amount AS "paymentAmount", payer_name AS "payerName", customer_id AS "customerId", invoice_id AS "invoiceId"
FROM payment
WHERE payment_id = $1
`,
)

export const listPaymentsStatement = defineStatement<[], Stored<PaymentListItem>>(
  'listPayments',
  `
SELECT p.payment_id AS "paymentId", p.payment_date AS "paymentDate", p.payment_method AS "paymentMethod",
       p.payment_amount AS "paymentAmount", p.payer_name AS "payerName", p.customer_id AS "customerId", p.invoice_id AS "invoiceId",
       c.customer_name AS "customerName"
FROM payment p
LEFT JOIN customer c ON c.customer_id = p.customer_id
ORDER BY p.payment_date DESC, p.payment_id
`,
)

export const identifyPaymentStatement = defineStatement<[paymentId: string, customerId: string], { readonly paymentId: string }>(
  'identifyPayment',
  `
UPDATE payment SET customer_id = $2
WHERE payment_id = $1 AND customer_id IS NULL AND invoice_id IS NULL
RETURNING payment_id AS "paymentId"
`,
)
