import type { RepositorySet } from '../../domain/repositorySet'
import { ensureClosable } from '../../domain/invoice/closingPolicy'
import { interpretClosingRequest, type ClosingRequest } from '../../domain/invoice/closingRequest'
import { planInvoiceCreate } from '../../domain/invoice/invoiceCreate'
import { assignInvoiceId, type InvoiceId } from '../../domain/invoice/value/invoiceId'
import type { IdGenerator } from '../../domain/shared/idGenerator'

/** 請求先の締め日までの売上・入金・返金・調整を、前回からの残高を繰り越した請求にまとめるため。 */
export async function closeInvoice(
  repositories: RepositorySet,
  idGenerator: IdGenerator,
  closingRequest: ClosingRequest,
): Promise<InvoiceId> {
  const closingInput = interpretClosingRequest(closingRequest)
  const billingCustomer = await repositories.customerRepository.lockCustomer(closingInput.billingCustomerId)
  const latestInvoice = await repositories.invoiceRepository.findLatestInvoice(billingCustomer.customerId)
  ensureClosable(billingCustomer, latestInvoice, closingInput)
  const unbilledEntries = await repositories.invoiceRepository.listUnbilledEntries(
    billingCustomer.customerId,
    closingInput.closingDate,
  )
  const invoiceId = assignInvoiceId(idGenerator)
  const invoiceCreate = planInvoiceCreate(invoiceId, billingCustomer, latestInvoice, closingInput, unbilledEntries)
  await repositories.invoiceRepository.createInvoice(invoiceCreate)
  return invoiceId
}
