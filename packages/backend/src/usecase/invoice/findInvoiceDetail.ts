import type { InvoiceDetail } from '../../domain/invoice/entity'
import { interpretInvoiceId } from '../../domain/invoice/value/invoiceId'
import type { RepositorySet } from '../../domain/repositorySet'

export async function findInvoiceDetail(repositories: RepositorySet, invoiceIdText: string): Promise<InvoiceDetail> {
  const invoiceId = interpretInvoiceId(invoiceIdText)
  const invoiceDetail = await repositories.invoiceRepository.findInvoiceDetail(invoiceId)
  return invoiceDetail
}
