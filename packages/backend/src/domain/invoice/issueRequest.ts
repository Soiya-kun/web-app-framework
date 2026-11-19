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

export function interpretIssueRequest(issueRequest: IssueRequest): IssueInput {
  return interpretFields({
    invoiceId: () => interpretInvoiceId(issueRequest.invoiceId),
    issueDate: () => interpretIssueDate(issueRequest.issueDate),
  })
}
