import { interpretFields } from '../shared/validation'
import { interpretInvoiceId, type InvoiceId } from './value/invoiceId'
import { interpretIssueDate, type IssueDate } from './value/issueDate'

/** 画面から届いた発行の入力。値はまだ検証していない。 */
export type IssueRequest = {
  readonly invoiceId: string
  readonly issueDate: string
}

export type IssueInput = {
  readonly invoiceId: InvoiceId
  readonly issueDate: IssueDate
}

/** 画面の入力を、発行に使える値にそろえるため。 */
export function interpretIssueRequest(issueRequest: IssueRequest): IssueInput {
  return interpretFields({
    invoiceId: () => interpretInvoiceId(issueRequest.invoiceId),
    issueDate: () => interpretIssueDate(issueRequest.issueDate),
  })
}
