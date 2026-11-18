import type { Brand } from '../../shared/brand'
import { splitDate } from '../../shared/calendar'
import { interpretDateText } from '../../shared/dateValue'

/** 請求を発行した日。請求番号の年は、この日の年にする。 */
export type IssueDate = Brand<string, 'IssueDate'>

/** 画面から入力された日付を、発行日として受け付けるため。 */
export function interpretIssueDate(text: string): IssueDate {
  return interpretDateText(text) as IssueDate
}

/** 請求番号を振る年を決めるため。 */
export function readIssueYear(issueDate: IssueDate): number {
  return splitDate(issueDate).year
}
