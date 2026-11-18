/** 日本時間の今日の日付（YYYY-MM-DD）。発行日などの初期値に使う。 */
export function readTodayText(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())
}
