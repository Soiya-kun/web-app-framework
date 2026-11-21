// 機能ごとの工数（人日）。いつも書くわけではない。
// audit は、AI が作ったものを人が監査する工数（AI 開発の時代の実際の工数）。
// manual は、もし人がコーディングとテストをしたら、という工数（ウォーターフォールの見積の考え方。営業の再見積に使う）。
// 対象は見積と同じく値で指すので、機能の名前を変えたり消したりすると型エラーになる。
import type { MeetingPlace } from './meeting'

export type EffortItem = {
  /** 対象の機能（シナリオ・業務フロー・画面・処理・旧システムのテーブルなど）。 */
  readonly target: MeetingPlace
  /** 監査の工数（人日）。 */
  readonly audit: number
  /** 人がコーディングとテストをする場合の工数（人日）。 */
  readonly manual: number
}

export type Effort = { readonly kind: 'effort'; readonly items: readonly EffortItem[] }

/** 機能ごとの工数を書く（apps/web/effort）。 */
export function defineEffort(items: readonly EffortItem[]): Effort {
  return { kind: 'effort', items }
}
