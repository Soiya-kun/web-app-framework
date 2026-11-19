import type { Brand } from '../shared/brand'
import { isEarlierDate } from '../shared/calendar'
import { ConflictError } from '../shared/error'
import { rejectField } from '../shared/validation'
import type { Invoice } from './entity'
import type { IssueInput } from './issueRequest'
import type { InvoiceId } from './value/invoiceId'
import { composeInvoiceNumber, type InvoiceNumber } from './value/invoiceNumber'
import { readIssueYear, type IssueDate } from './value/issueDate'

/** 発行で保存する値。invoice テーブルの invoice_number・issue_date に入る。 */
export type InvoiceIssue = Brand<
  {
    readonly invoiceId: InvoiceId
    readonly invoiceNumber: InvoiceNumber
    readonly issueDate: IssueDate
  },
  'InvoiceIssue'
>

export function ensureIssuable(invoice: Invoice, issueInput: IssueInput): void {
  if (invoice.issueDate !== null) {
    throw new ConflictError('issuedInvoice')
  }
  if (isEarlierDate(issueInput.issueDate, invoice.closingDate)) {
    throw rejectField('issueDate', 'earlyIssueDate', { closingDate: invoice.closingDate })
  }
}

export function planInvoiceIssue(invoice: Invoice, issueInput: IssueInput, lastNumber: number): InvoiceIssue {
  return {
    invoiceId: invoice.invoiceId,
    invoiceNumber: composeInvoiceNumber(readIssueYear(issueInput.issueDate), lastNumber),
    issueDate: issueInput.issueDate,
  } as InvoiceIssue
}
