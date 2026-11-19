import type { InvoiceListItem } from '../../domain/invoice/entity'
import type { RepositorySet } from '../../domain/repositorySet'

export async function listInvoices(repositories: RepositorySet): Promise<readonly InvoiceListItem[]> {
  const invoices = await repositories.invoiceRepository.listInvoices()
  return invoices
}
