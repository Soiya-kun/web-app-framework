declare const statementKey: unique symbol
declare const valuesKey: unique symbol
declare const rowKey: unique symbol

/**
 * 実行する SQL 1文。本文は固定で、値は $1・$2… で渡す。
 * Executor はこの型しか受け付けないので、組み立てた SQL は実行できない。全文は SQL の台帳（docs/generated/sql-ledger.md）に載る。
 */
export type Statement<Values extends readonly unknown[], Row> = {
  readonly [statementKey]: true
  readonly [valuesKey]?: Values
  readonly [rowKey]?: Row
  readonly name: string
  readonly text: string
}

/** SQL 1文を定義する。text は式を埋め込まない固定の文字列にする（台帳の生成で検査する）。 */
export function defineStatement<Values extends readonly unknown[], Row = never>(
  name: string,
  text: string,
): Statement<Values, Row> {
  return { name, text: text.trim() } as Statement<Values, Row>
}

/** SQL を実行する口。repository はこれだけを使って DB を読み書きする。 */
export type Executor = {
  execute<Values extends readonly unknown[], Row>(statement: Statement<Values, Row>, values: Values): Promise<readonly Row[]>
}
