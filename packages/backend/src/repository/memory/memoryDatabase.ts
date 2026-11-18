import type { Customer } from '../../domain/customer/entity'
import type { Sales } from '../../domain/sales/entity'
import type { Stored } from '../../domain/shared/brand'

/** 画面の結合テストで本物の DB の代わりに使う。テーブルごとに、保存の形（Stored）の行の配列を持つ。 */
export type MemoryDatabase = {
  readonly customer: Stored<Customer>[]
  readonly sales: Stored<Sales>[]
}

export function prepareMemoryDatabase(seed: Partial<MemoryDatabase> = {}): MemoryDatabase {
  return {
    customer: [...(seed.customer ?? [])],
    sales: [...(seed.sales ?? [])],
  }
}

/** 失敗したトランザクションの取り消しに使うため、全テーブルの行を写し取る。 */
export function copyMemoryDatabase(database: MemoryDatabase): MemoryDatabase {
  return structuredClone(database)
}

/** 写し取った行へ、全テーブルを戻す。 */
export function restoreMemoryDatabase(database: MemoryDatabase, copy: MemoryDatabase): void {
  database.customer.splice(0, database.customer.length, ...copy.customer)
  database.sales.splice(0, database.sales.length, ...copy.sales)
}
