import type { CustomerRow, SalesRow } from '../table'

/** 画面の結合テストで本物の DB の代わりに使う。テーブルごとに行の配列を持つ。 */
export type MemoryDatabase = {
  readonly customer: CustomerRow[]
  readonly sales: SalesRow[]
}

export function prepareMemoryDatabase(seed: Partial<MemoryDatabase> = {}): MemoryDatabase {
  return {
    customer: [...(seed.customer ?? [])],
    sales: [...(seed.sales ?? [])],
  }
}
