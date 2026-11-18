import type { InvoiceListItem } from '../../domain/invoice/entity'
import type { RepositorySet } from '../../domain/repositorySet'

/** 締めた請求を、発行の状態と金額とともに示すため。 */
export async function listInvoices(repositories: RepositorySet): Promise<readonly InvoiceListItem[]> {
  const invoices = await repositories.invoiceRepository.listInvoices()
  return invoices
}
