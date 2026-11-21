// 見積の書き方。項目の名前と金額が最小の単位で、いつも書くわけではない。
// 対象（新しい業務フロー・シナリオ・拡張・画面・処理・現行の業務フロー・旧システムのテーブル）を値で指すと、
// 見積から業務と機能まで追え、名前を変えたり消したりすると型エラーになる。
import type { MeetingPlace } from './meeting'

export type EstimateItem = {
  /** 項目の名前。 */
  readonly title: string
  /** 金額（円）。 */
  readonly amount: number
  /** 対象（書かなくてもよい）。 */
  readonly targets?: readonly MeetingPlace[]
}

export type Estimate = {
  readonly kind: 'estimate'
  /** 見積の日（YYYY-MM-DD）。 */
  readonly date: string
  readonly title: string
  /** 1人日の単価（円）。機能ごとの工数（defineEffort）を金額にするのに使う。書かなくてもよい。 */
  readonly rate: number | undefined
  readonly items: readonly EstimateItem[]
}

/** 見積を書く。変数の名前は estimate と日付（estimate20261031）にする。版ごとに1ファイル。 */
export function defineEstimate(date: string, definition: { readonly title: string; readonly rate?: number; readonly items: readonly EstimateItem[] }): Estimate {
  return { kind: 'estimate', date, title: definition.title, rate: definition.rate, items: definition.items }
}
