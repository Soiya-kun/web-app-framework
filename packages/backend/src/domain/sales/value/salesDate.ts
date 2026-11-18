import type { Brand } from '../../shared/brand'
import { isCalendarDate } from '../../shared/calendar'
import { rejectValue } from '../../shared/validation'

/** 売上を計上した日（YYYY-MM-DD）。 */
export type SalesDate = Brand<string, 'SalesDate'>

/** 画面から入力された日付を、売上日として受け付けるため。 */
export function interpretSalesDate(text: string): SalesDate {
  const trimmedText = text.trim()
  if (trimmedText === '') {
    throw rejectValue('inputRequired')
  }
  if (!isCalendarDate(trimmedText)) {
    throw rejectValue('invalidDate')
  }
  return trimmedText as SalesDate
}
