import type { Brand } from './brand'

/** 円の金額（整数。負もある）。請求書の金額に使う。 */
export type Yen = Brand<number, 'Yen'>

/** 金額を合計する。 */
export function sumYen(amounts: readonly number[]): Yen {
  return amounts.reduce((total, amount) => total + amount, 0) as Yen
}
