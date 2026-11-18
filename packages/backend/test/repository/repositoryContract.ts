// repository の契約のテスト。同じテストをモック DB と PostgreSQL に流し、振る舞いがずれていないことを確かめる。
import { beforeEach, describe, expect, test } from 'vitest'
import type { Customer } from '../../src/domain/customer/entity'
import type { CustomerId } from '../../src/domain/customer/value/customerId'
import type { RepositorySet, RunTransaction } from '../../src/domain/repositorySet'
import type { Sales } from '../../src/domain/sales/entity'
import type { SalesCreate } from '../../src/domain/sales/salesCreate'
import type { Stored } from '../../src/domain/shared/brand'
import { NotFoundError } from '../../src/domain/shared/error'

/** テストの対象。テストのための行の出し入れは、対象ごとに用意する。 */
export type RepositoryTarget = {
  readonly repositories: RepositorySet
  readonly runTransaction: RunTransaction
  seedCustomers(customers: readonly Stored<Customer>[]): Promise<void>
  readSales(): Promise<readonly Stored<Sales>[]>
}

export const parentCustomer: Stored<Customer> = {
  customerId: 'customer-0001',
  customerName: '株式会社親',
  billingCustomerId: 'customer-0001',
  closingDay: 31,
  collectionMonthOffset: 1,
  collectionDay: 31,
}

export const childCustomer: Stored<Customer> = {
  customerId: 'customer-0002',
  customerName: '株式会社子',
  billingCustomerId: 'customer-0001',
  closingDay: 20,
  collectionMonthOffset: 0,
  collectionDay: 25,
}

export const returnSales: Stored<Sales> = {
  salesId: 'sales-0001',
  customerId: 'customer-0002',
  salesDate: '2026-11-18',
  salesKind: 'return',
  itemName: '返品（運賃）',
  salesAmount: -5000,
  taxRate: 8,
}

export function describeRepositoryContract(name: string, prepareTarget: () => Promise<RepositoryTarget>): void {
  describe(`${name} の repository`, () => {
    let target: RepositoryTarget

    beforeEach(async () => {
      target = await prepareTarget()
      await target.seedCustomers([parentCustomer, childCustomer])
    })

    test('顧客を ID で取得する', async () => {
      expect(await target.repositories.customerRepository.findCustomer(childCustomer.customerId as CustomerId)).toEqual(
        childCustomer,
      )
    })

    test('ない顧客は NotFoundError にする', async () => {
      await expect(
        target.repositories.customerRepository.findCustomer('customer-9999' as CustomerId),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    test('顧客を ID の順に一覧する', async () => {
      expect(await target.repositories.customerRepository.listCustomers()).toEqual([parentCustomer, childCustomer])
    })

    test('売上を、入力境界の項目のまま1行として保存する', async () => {
      await target.repositories.salesRepository.createSales(returnSales as SalesCreate)

      expect(await target.readSales()).toEqual([returnSales])
    })

    test('同じ ID の売上は保存しない', async () => {
      await target.repositories.salesRepository.createSales(returnSales as SalesCreate)

      await expect(target.repositories.salesRepository.createSales(returnSales as SalesCreate)).rejects.toThrow()
    })

    test('トランザクションの処理が例外で終わったら、書いた内容を取り消す', async () => {
      await expect(
        target.runTransaction(async (repositories) => {
          await repositories.salesRepository.createSales(returnSales as SalesCreate)
          throw new Error('途中で失敗')
        }),
      ).rejects.toThrow('途中で失敗')

      expect(await target.readSales()).toEqual([])
    })
  })
}
