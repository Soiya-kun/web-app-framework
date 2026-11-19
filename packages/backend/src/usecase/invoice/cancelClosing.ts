import type { RepositorySet } from '../../domain/repositorySet'
import { ensureClosingCancelable, planClosingCancel } from '../../domain/invoice/closingCancel'
import { interpretInvoiceId } from '../../domain/invoice/value/invoiceId'

export async function cancelClosing(repositories: RepositorySet, invoiceIdText: string): Promise<void> {
  const invoiceId = interpretInvoiceId(invoiceIdText)
  const invoice = await repositories.invoiceRepository.findInvoice(invoiceId)
  await repositories.customerRepository.lockCustomer(invoice.billingCustomerId)
  ensureClosingCancelable(invoice)
  const closingCancel = planClosingCancel(invoice)
  await repositories.invoiceRepository.cancelClosing(closingCancel)
}
