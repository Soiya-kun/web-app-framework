import type { RepositorySet } from '../../domain/repositorySet'
import { ensureClosingCancelable, planClosingCancel } from '../../domain/invoice/closingCancel'
import { interpretInvoiceId } from '../../domain/invoice/value/invoiceId'

/** 発行前の請求の誤りを直せるよう、締めを取り消して売上・入金などを請求に載せる前へ戻すため。 */
export async function cancelClosing(repositories: RepositorySet, invoiceIdText: string): Promise<void> {
  const invoiceId = interpretInvoiceId(invoiceIdText)
  const invoice = await repositories.invoiceRepository.findInvoice(invoiceId)
  await repositories.customerRepository.lockCustomer(invoice.billingCustomerId)
  ensureClosingCancelable(invoice)
  const closingCancel = planClosingCancel(invoice)
  await repositories.invoiceRepository.cancelClosing(closingCancel)
}
