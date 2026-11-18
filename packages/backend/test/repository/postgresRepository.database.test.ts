import { afterAll, describe, expect, test } from 'vitest'
import type { Customer } from '../../src/domain/customer/entity'
import type { CustomerId } from '../../src/domain/customer/value/customerId'
import type { Sales } from '../../src/domain/sales/entity'
import type { SalesCreate } from '../../src/domain/sales/salesCreate'
import type { Stored } from '../../src/domain/shared/brand'
import {
  prepareClientExecutor,
  preparePostgresPool,
  preparePostgresRepositories,
  preparePostgresTransaction,
} from '../../src/repository/postgres/postgresDatabase'
import type { Executor } from '../../src/repository/postgres/statement'
import { testDatabaseUrl } from '../testDatabase'
import { childCustomer, describeRepositoryContract, parentCustomer, returnSales, type RepositoryTarget } from './repositoryContract'

const pool = preparePostgresPool(testDatabaseUrl)

afterAll(async () => {
  await pool.end()
})

/** 実行した SQL の名前を記録する。テストで、どの SQL が流れたかを確かめる。 */
function prepareRecordingExecutor(executor: Executor, statementNames: string[]): Executor {
  return {
    async execute(statement, values) {
      statementNames.push(statement.name)
      return executor.execute(statement, values)
    },
  }
}

async function preparePostgresTarget(statementNames: string[] = []): Promise<RepositoryTarget> {
  await pool.query(
    'TRUNCATE customer, payer_name, sales, invoice, invoice_sales, invoice_tax, invoice_counter, payment, reconciliation, allocation, adjustment, refund CASCADE',
  )
  return {
    repositories: preparePostgresRepositories(prepareRecordingExecutor(prepareClientExecutor(pool), statementNames)),
    runTransaction: preparePostgresTransaction(pool),
    async seedCustomers(customers: readonly Stored<Customer>[]) {
      for (const customer of customers) {
        await pool.query(
          'INSERT INTO customer (customer_id, customer_name, billing_customer_id, closing_day, collection_month_offset, collection_day) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            customer.customerId,
            customer.customerName,
            customer.billingCustomerId,
            customer.closingDay,
            customer.collectionMonthOffset,
            customer.collectionDay,
          ],
        )
      }
    },
    async readSales() {
      const result = await pool.query<Stored<Sales>>(
        'SELECT sales_id AS "salesId", customer_id AS "customerId", sales_date AS "salesDate", sales_kind AS "salesKind", item_name AS "itemName", sales_amount AS "salesAmount", tax_rate AS "taxRate" FROM sales ORDER BY sales_id',
      )
      return result.rows
    },
  }
}

describeRepositoryContract('PostgreSQL', () => preparePostgresTarget())

describe('PostgreSQL で実行する SQL', () => {
  test('顧客の取得は findCustomer の1文だけを実行する', async () => {
    const statementNames: string[] = []
    const target = await preparePostgresTarget(statementNames)
    await target.seedCustomers([parentCustomer, childCustomer])

    await target.repositories.customerRepository.findCustomer(childCustomer.customerId as CustomerId)

    expect(statementNames).toEqual(['findCustomer'])
  })

  test('売上の登録は createSales の1文だけを実行する', async () => {
    const statementNames: string[] = []
    const target = await preparePostgresTarget(statementNames)
    await target.seedCustomers([parentCustomer, childCustomer])

    await target.repositories.salesRepository.createSales(returnSales as SalesCreate)

    expect(statementNames).toEqual(['createSales'])
  })

  test('返品の売上を正の金額で保存しようとすると、DB の制約で止める', async () => {
    const target = await preparePostgresTarget()
    await target.seedCustomers([parentCustomer, childCustomer])

    await expect(
      target.repositories.salesRepository.createSales({ ...returnSales, salesAmount: 5000 } as SalesCreate),
    ).rejects.toThrow(/sales_check/)
  })
})
