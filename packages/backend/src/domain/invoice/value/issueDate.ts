import type { Brand } from '../../shared/brand'
import { splitDate } from '../../shared/calendar'
import { interpretDateText } from '../../shared/dateValue'

/** 請求を発行した日。請求番号の年は、この日の年にする。 */
export type IssueDate = Brand<string, 'IssueDate'>

export function interpretIssueDate(text: string): IssueDate {
  return interpretDateText(text) as IssueDate
}

export function readIssueYear(issueDate: IssueDate): number {
  return splitDate(issueDate).year
}
