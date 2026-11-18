// テーブルの行の形。本番の DB とテスト用のモック DB が同じ形を使う。

/** customer テーブルの1行。 */
export type CustomerRow = {
  readonly customerId: string
  readonly customerName: string
}

/** sales テーブルの1行。 */
export type SalesRow = {
  readonly salesId: string
  readonly customerId: string
  readonly salesDate: string
  readonly salesAmount: number
}
