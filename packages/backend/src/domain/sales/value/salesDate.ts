import type { Brand } from '../../shared/brand'
import { interpretDateText } from '../../shared/dateValue'

/** 売上を計上した日（YYYY-MM-DD）。 */
export type SalesDate = Brand<string, 'SalesDate'>

/** 画面から入力された日付を、売上日として受け付けるため。 */
export function interpretSalesDate(text: string): SalesDate {
  return interpretDateText(text) as SalesDate
}
