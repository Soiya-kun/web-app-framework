import type { RepositorySet } from '../../domain/repositorySet'
import { ensureIssuable, planInvoiceIssue } from '../../domain/invoice/invoiceIssue'
import { interpretIssueRequest, type IssueRequest } from '../../domain/invoice/issueRequest'
import type { InvoiceNumber } from '../../domain/invoice/value/invoiceNumber'
import { readIssueYear } from '../../domain/invoice/value/issueDate'

/** 締めた請求に請求番号を振って発行し、以後は変えないようにするため。 */
export async function issueInvoice(repositories: RepositorySet, issueRequest: IssueRequest): Promise<InvoiceNumber> {
  const issueInput = interpretIssueRequest(issueRequest)
  const invoice = await repositories.invoiceRepository.findInvoice(issueInput.invoiceId)
  ensureIssuable(invoice, issueInput)
  const issueYear = readIssueYear(issueInput.issueDate)
  const lastNumber = await repositories.invoiceRepository.takeInvoiceNumber(issueYear)
  const invoiceIssue = planInvoiceIssue(invoice, issueInput, lastNumber)
  await repositories.invoiceRepository.issueInvoice(invoiceIssue)
  return invoiceIssue.invoiceNumber
}
