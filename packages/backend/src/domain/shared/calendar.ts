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
