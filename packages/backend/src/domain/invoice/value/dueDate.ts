import type { MonthDay } from '../../customer/value/monthDay'
import type { MonthOffset } from '../../customer/value/monthOffset'
import type { Brand } from '../../shared/brand'
import { isEarlierDate, placeMonthDay, shiftMonth, splitDate } from '../../shared/calendar'
import type { ClosingDate } from './closingDate'

/** 入金期日。請求先がこの日までに今回請求額を入金する。 */
export type DueDate = Brand<string, 'DueDate'>

/**
 * 請求締め日と請求先の回収条件から、入金期日を決めるため。
 * 回収日 31 や、その月にない日は月末にする。締め日より前になるとき（当月回収で回収日が締め日より前）は翌月にする。
 */
export function decideDueDate(closingDate: ClosingDate, collectionMonthOffset: MonthOffset, collectionDay: MonthDay): DueDate {
  const closingParts = splitDate(closingDate)
  const target = shiftMonth(closingParts.year, closingParts.month, collectionMonthOffset)
  const dueDate = placeMonthDay(target.year, target.month, collectionDay)
  if (!isEarlierDate(dueDate, closingDate)) {
    return dueDate as DueDate
  }
  const nextTarget = shiftMonth(target.year, target.month, 1)
  return placeMonthDay(nextTarget.year, nextTarget.month, collectionDay) as DueDate
}
