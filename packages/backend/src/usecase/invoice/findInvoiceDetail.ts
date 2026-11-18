import type { InvoiceDetail } from '../../domain/invoice/entity'
import { interpretInvoiceId } from '../../domain/invoice/value/invoiceId'
import type { RepositorySet } from '../../domain/repositorySet'

/** 請求書の中身（見出し・税率ごとの合計・載せた売上と入金）を示すため。 */
export async function findInvoiceDetail(repositories: RepositorySet, invoiceIdText: string): Promise<InvoiceDetail> {
  const invoiceId = interpretInvoiceId(invoiceIdText)
  const invoiceDetail = await repositories.invoiceRepository.findInvoiceDetail(invoiceId)
  return invoiceDetail
}
