/** 日付の年・月・日。月は 1〜12。 */
export type DateParts = {
  readonly year: number
  readonly month: number
  readonly day: number
}

/** YYYY-MM-DD の形で、暦に実在する日付かどうか。 */
export function isCalendarDate(text: string): boolean {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (matched === null) {
    return false
  }
  const year = Number(matched[1])
  const month = Number(matched[2])
  const day = Number(matched[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** 検証済みの YYYY-MM-DD を、年・月・日に分ける。 */
export function splitDate(text: string): DateParts {
  const [year = 0, month = 0, day = 0] = text.split('-').map(Number)
  return { year, month, day }
}

/** 年・月・日を YYYY-MM-DD にする。 */
export function composeDate(parts: DateParts): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

/** その月の日数（うるう年の2月は29）。 */
export function measureMonthLength(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** 年・月を、月数だけ後へずらす。 */
export function shiftMonth(year: number, month: number, offset: number): { readonly year: number; readonly month: number } {
  const index = year * 12 + (month - 1) + offset
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

/**
 * 月の中の日（1〜31。31 は月末）を、その年・月の日付にする。その月にない日（2月30日など）も月末にする。
 * 締日・回収日を実際の日付にするときに使う。
 */
export function placeMonthDay(year: number, month: number, monthDay: number): string {
  return composeDate({ year, month, day: Math.min(monthDay, measureMonthLength(year, month)) })
}

/** 日付（YYYY-MM-DD）の前後を比べる。left が right より前の日付なら true。 */
export function isEarlierDate(left: string, right: string): boolean {
  return left < right
}
