// PostgreSQL の表を空にし、モック DB と同じ形（MemoryDatabase）の行を入れる。
// DB の契約テストと、業務フローを実ブラウザ・実 DB で流す E2E で、事前条件の行を入れるのに使う。
import type pg from 'pg'
import type { MemoryDatabase } from '../src/repository/memory/memoryDatabase'

/** 業務の表を、すべて空にする。 */
export async function resetTables(database: pg.Pool): Promise<void> {
  await database.query('TRUNCATE customer, payer_name, invoice, invoice_tax, invoice_counter, sales, payment, refund, adjustment CASCADE', [])
}

/** 行を、外部キーの順（顧客 → 請求 → 売上・入金など）に入れる。 */
export async function seedTables(database: pg.Pool, seed: Partial<MemoryDatabase>): Promise<void> {
  for (const row of seed.customer ?? []) {
    await database.query(
      'INSERT INTO customer (customer_id, customer_name, billing_customer_id, closing_day, collection_month_offset, collection_day) VALUES ($1, $2, $3, $4, $5, $6)',
      [row.customerId, row.customerName, row.billingCustomerId, row.closingDay, row.collectionMonthOffset, row.collectionDay],
    )
  }
  for (const row of seed.payerName ?? []) {
    await database.query('INSERT INTO payer_name (payer_name, customer_id) VALUES ($1, $2)', [row.payerName, row.customerId])
  }
  for (const row of seed.invoice ?? []) {
    await database.query(
      'INSERT INTO invoice (invoice_id, billing_customer_id, previous_invoice_id, closing_date, due_date, previous_amount, payment_amount, adjustment_amount, carried_amount, sales_amount, tax_amount, invoice_amount, invoice_number, issue_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
      [
        row.invoiceId,
        row.billingCustomerId,
        row.previousInvoiceId,
        row.closingDate,
        row.dueDate,
        row.previousAmount,
        row.paymentAmount,
        row.adjustmentAmount,
        row.carriedAmount,
        row.salesAmount,
        row.taxAmount,
        row.invoiceAmount,
        row.invoiceNumber,
        row.issueDate,
      ],
    )
  }
  for (const row of seed.invoiceTax ?? []) {
    await database.query('INSERT INTO invoice_tax (invoice_id, tax_rate, taxable_amount, tax_amount) VALUES ($1, $2, $3, $4)', [
      row.invoiceId,
      row.taxRate,
      row.taxableAmount,
      row.taxAmount,
    ])
  }
  for (const row of seed.invoiceCounter ?? []) {
    await database.query('INSERT INTO invoice_counter (issue_year, last_number) VALUES ($1, $2)', [row.issueYear, row.lastNumber])
  }
  for (const row of seed.sales ?? []) {
    await database.query(
      'INSERT INTO sales (sales_id, customer_id, sales_date, sales_kind, item_name, sales_amount, tax_rate, invoice_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [row.salesId, row.customerId, row.salesDate, row.salesKind, row.itemName, row.salesAmount, row.taxRate, row.invoiceId],
    )
  }
  for (const row of seed.payment ?? []) {
    await database.query(
      'INSERT INTO payment (payment_id, payment_date, payment_method, payment_amount, payer_name, customer_id, invoice_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [row.paymentId, row.paymentDate, row.paymentMethod, row.paymentAmount, row.payerName, row.customerId, row.invoiceId],
    )
  }
  for (const row of seed.refund ?? []) {
    await database.query(
      'INSERT INTO refund (refund_id, payment_id, refund_date, refund_amount, invoice_id) VALUES ($1, $2, $3, $4, $5)',
      [row.refundId, row.paymentId, row.refundDate, row.refundAmount, row.invoiceId],
    )
  }
  for (const row of seed.adjustment ?? []) {
    await database.query(
      'INSERT INTO adjustment (adjustment_id, billing_customer_id, adjustment_date, adjustment_kind, adjustment_amount, payment_id, invoice_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [row.adjustmentId, row.billingCustomerId, row.adjustmentDate, row.adjustmentKind, row.adjustmentAmount, row.paymentId, row.invoiceId],
    )
  }
}
