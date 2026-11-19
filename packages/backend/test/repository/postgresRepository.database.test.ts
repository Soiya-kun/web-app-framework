import { afterAll, describe, expect, test } from 'vitest'
import type { CustomerId } from '../../src/domain/customer/value/customerId'
import type { ClosingDate } from '../../src/domain/invoice/value/closingDate'
import type { SalesCreate } from '../../src/domain/sales/salesCreate'
import type { MemoryDatabase } from '../../src/repository/memory/memoryDatabase'
import { prepareSequenceIdGenerator } from '../../src/repository/sequenceIdGenerator'
import {
  prepareClientExecutor,
  preparePostgresPool,
  preparePostgresRepositories,
  preparePostgresTransaction,
} from '../../src/repository/postgres/postgresDatabase'
import type { Executor } from '../../src/repository/postgres/statement'
import { closeInvoice } from '../../src/usecase/invoice/closeInvoice'
import { testDatabaseUrl } from '../testDatabase'
import {
  childCustomer,
  childSales,
  describeRepositoryContract,
  laterSales,
  otherCustomer,
  parentAdjustment,
  parentCustomer,
  parentPayment,
  parentRefund,
  type RepositoryTarget,
} from './repositoryContract'

const pool = preparePostgresPool({ connectionText: testDatabaseUrl })

afterAll(async () => {
  await pool.end()
})

/** 実行した SQL の名前を記録する。テストで、どの SQL が流れたかを確かめる。 */
function prepareTracingExecutor(executor: Executor, statementNames: string[]): Executor {
  return {
    async execute(statement, values) {
      statementNames.push(statement.name)
      return executor.execute(statement, values)
    },
  }
}

async function selectRows<Row>(text: string, values: readonly unknown[] = []): Promise<Row[]> {
  const result = await pool.query(text, [...values])
  return result.rows as Row[]
}

async function seedTables(seed: Partial<MemoryDatabase>): Promise<void> {
  for (const row of seed.customer ?? []) {
    await selectRows(
      'INSERT INTO customer (customer_id, customer_name, billing_customer_id, closing_day, collection_month_offset, collection_day) VALUES ($1, $2, $3, $4, $5, $6)',
      [row.customerId, row.customerName, row.billingCustomerId, row.closingDay, row.collectionMonthOffset, row.collectionDay],
    )
  }
  for (const row of seed.payerName ?? []) {
    await selectRows('INSERT INTO payer_name (payer_name, customer_id) VALUES ($1, $2)', [row.payerName, row.customerId])
  }
  for (const row of seed.invoice ?? []) {
    await selectRows(
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
    await selectRows('INSERT INTO invoice_tax (invoice_id, tax_rate, taxable_amount, tax_amount) VALUES ($1, $2, $3, $4)', [
      row.invoiceId,
      row.taxRate,
      row.taxableAmount,
      row.taxAmount,
    ])
  }
  for (const row of seed.invoiceCounter ?? []) {
    await selectRows('INSERT INTO invoice_counter (issue_year, last_number) VALUES ($1, $2)', [row.issueYear, row.lastNumber])
  }
  for (const row of seed.sales ?? []) {
    await selectRows(
      'INSERT INTO sales (sales_id, customer_id, sales_date, sales_kind, item_name, sales_amount, tax_rate, invoice_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [row.salesId, row.customerId, row.salesDate, row.salesKind, row.itemName, row.salesAmount, row.taxRate, row.invoiceId],
    )
  }
  for (const row of seed.payment ?? []) {
    await selectRows(
      'INSERT INTO payment (payment_id, payment_date, payment_method, payment_amount, payer_name, customer_id, invoice_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [row.paymentId, row.paymentDate, row.paymentMethod, row.paymentAmount, row.payerName, row.customerId, row.invoiceId],
    )
  }
  for (const row of seed.refund ?? []) {
    await selectRows(
      'INSERT INTO refund (refund_id, payment_id, refund_date, refund_amount, invoice_id) VALUES ($1, $2, $3, $4, $5)',
      [row.refundId, row.paymentId, row.refundDate, row.refundAmount, row.invoiceId],
    )
  }
  for (const row of seed.adjustment ?? []) {
    await selectRows(
      'INSERT INTO adjustment (adjustment_id, billing_customer_id, adjustment_date, adjustment_kind, adjustment_amount, payment_id, invoice_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [row.adjustmentId, row.billingCustomerId, row.adjustmentDate, row.adjustmentKind, row.adjustmentAmount, row.paymentId, row.invoiceId],
    )
  }
}

async function readTables(): Promise<MemoryDatabase> {
  return {
    customer: await selectRows(
      'SELECT customer_id AS "customerId", customer_name AS "customerName", billing_customer_id AS "billingCustomerId", closing_day AS "closingDay", collection_month_offset AS "collectionMonthOffset", collection_day AS "collectionDay" FROM customer ORDER BY customer_id',
    ),
    payerName: await selectRows('SELECT payer_name AS "payerName", customer_id AS "customerId" FROM payer_name ORDER BY payer_name'),
    invoice: await selectRows(
      'SELECT invoice_id AS "invoiceId", billing_customer_id AS "billingCustomerId", previous_invoice_id AS "previousInvoiceId", closing_date AS "closingDate", due_date AS "dueDate", previous_amount AS "previousAmount", payment_amount AS "paymentAmount", adjustment_amount AS "adjustmentAmount", carried_amount AS "carriedAmount", sales_amount AS "salesAmount", tax_amount AS "taxAmount", invoice_amount AS "invoiceAmount", invoice_number AS "invoiceNumber", issue_date AS "issueDate" FROM invoice ORDER BY invoice_id',
    ),
    invoiceTax: await selectRows(
      'SELECT invoice_id AS "invoiceId", tax_rate AS "taxRate", taxable_amount AS "taxableAmount", tax_amount AS "taxAmount" FROM invoice_tax ORDER BY invoice_id, tax_rate DESC',
    ),
    invoiceCounter: await selectRows('SELECT issue_year AS "issueYear", last_number AS "lastNumber" FROM invoice_counter ORDER BY issue_year'),
    sales: await selectRows(
      'SELECT sales_id AS "salesId", customer_id AS "customerId", sales_date AS "salesDate", sales_kind AS "salesKind", item_name AS "itemName", sales_amount AS "salesAmount", tax_rate AS "taxRate", invoice_id AS "invoiceId" FROM sales ORDER BY sales_id',
    ),
    payment: await selectRows(
      'SELECT payment_id AS "paymentId", payment_date AS "paymentDate", payment_method AS "paymentMethod", payment_amount AS "paymentAmount", payer_name AS "payerName", customer_id AS "customerId", invoice_id AS "invoiceId" FROM payment ORDER BY payment_id',
    ),
    refund: await selectRows(
      'SELECT refund_id AS "refundId", payment_id AS "paymentId", refund_date AS "refundDate", refund_amount AS "refundAmount", invoice_id AS "invoiceId" FROM refund ORDER BY refund_id',
    ),
    adjustment: await selectRows(
      'SELECT adjustment_id AS "adjustmentId", billing_customer_id AS "billingCustomerId", adjustment_date AS "adjustmentDate", adjustment_kind AS "adjustmentKind", adjustment_amount AS "adjustmentAmount", payment_id AS "paymentId", invoice_id AS "invoiceId" FROM adjustment ORDER BY adjustment_id',
    ),
  }
}

async function preparePostgresTarget(statementNames: string[] = []): Promise<RepositoryTarget> {
  await pool.query('TRUNCATE customer, payer_name, invoice, invoice_tax, invoice_counter, sales, payment, refund, adjustment CASCADE')
  return {
    repositories: preparePostgresRepositories(prepareTracingExecutor(prepareClientExecutor(pool), statementNames)),
    runTransaction: preparePostgresTransaction(pool),
    seedTables,
    readTables,
  }
}

describeRepositoryContract('PostgreSQL', () => preparePostgresTarget())

describe('PostgreSQL で実行する SQL', () => {
  test('売上の登録は createSales の1文だけを実行する', async () => {
    const statementNames: string[] = []
    const target = await preparePostgresTarget(statementNames)
    await target.seedTables({ customer: [parentCustomer, childCustomer] })

    await target.repositories.salesRepository.createSales({ ...laterSales, invoiceId: undefined } as unknown as SalesCreate)

    expect(statementNames).toEqual(['createSales'])
  })

  test('締めの対象は、売上・入金・返金・調整の4文をロック付きで読む', async () => {
    const statementNames: string[] = []
    const target = await preparePostgresTarget(statementNames)
    await target.seedTables({ customer: [parentCustomer, childCustomer] })

    await target.repositories.invoiceRepository.listUnbilledEntries('customer-0001' as CustomerId, '2026-10-31' as ClosingDate)

    expect(statementNames).toEqual(['listUnbilledSales', 'listUnbilledPayments', 'listUnbilledRefunds', 'listUnbilledAdjustments'])
  })

  test('返品の売上を正の金額で保存しようとすると、DB の制約で止める', async () => {
    const target = await preparePostgresTarget()
    await target.seedTables({ customer: [parentCustomer] })

    await expect(
      target.repositories.salesRepository.createSales({ ...laterSales, salesAmount: 3000 } as unknown as SalesCreate),
    ).rejects.toThrow(/sales_check/)
  })

  test('同じ請求先を同時に締めても、請求は1件だけできる（請求先の行のロックで順に並ぶ）', async () => {
    const target = await preparePostgresTarget()
    await target.seedTables({
      customer: [parentCustomer, childCustomer, otherCustomer],
      sales: [childSales],
      payment: [parentPayment],
      refund: [parentRefund],
      adjustment: [parentAdjustment],
    })
    const idGenerator = prepareSequenceIdGenerator()
    const closingRequest = { billingCustomerId: 'customer-0001', closingDate: '2026-10-31' }

    const results = await Promise.allSettled([
      target.runTransaction((repositories) => closeInvoice(repositories, idGenerator, closingRequest)),
      target.runTransaction((repositories) => closeInvoice(repositories, idGenerator, closingRequest)),
    ])

    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected'])
    const tables = await target.readTables()
    expect(tables.invoice).toHaveLength(1)
    expect(tables.sales.map((row) => row.invoiceId)).toEqual([tables.invoice[0]?.invoiceId])
  })
})
