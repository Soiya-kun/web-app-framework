import { isCalendarDate } from './calendar'
import { rejectValue } from './validation'

/** 画面から入力された日付の文字列を、YYYY-MM-DD の実在する日付として受け付けるため。値の型は呼び出し側で決める。 */
export function interpretDateText(text: string): string {
  const trimmedText = text.trim()
  if (trimmedText === '') {
    throw rejectValue('inputRequired')
  }
  if (!isCalendarDate(trimmedText)) {
    throw rejectValue('invalidDate')
  }
  return trimmedText
}
