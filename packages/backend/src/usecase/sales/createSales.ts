import type { CustomerRepository } from '../../domain/customer/customerRepository'
import { planSalesCreate } from '../../domain/sales/salesCreate'
import type { SalesRepository } from '../../domain/sales/salesRepository'
import { interpretSalesRequest, type SalesRequest } from '../../domain/sales/salesRequest'
import { assignSalesId, type SalesId } from '../../domain/sales/value/salesId'
import type { IdGenerator } from '../../domain/shared/idGenerator'

/** 顧客への売上を計上するため。 */
export async function createSales(
  salesRepository: SalesRepository,
  customerRepository: CustomerRepository,
  idGenerator: IdGenerator,
  salesRequest: SalesRequest,
): Promise<SalesId> {
  const salesInput = interpretSalesRequest(salesRequest)
  const customer = await customerRepository.findCustomer(salesInput.customerId)
  const salesId = assignSalesId(idGenerator)
  const salesCreate = planSalesCreate(salesId, customer, salesInput)
  await salesRepository.createSales(salesCreate)
  return salesId
}
