import type { SalesCreate } from './salesCreate'

export type SalesRepository = {
  /** SalesCreate の項目を、そのまま1行として保存する。 */
  createSales(salesCreate: SalesCreate): Promise<void>
}
