import { selectBillingCustomers } from '../../domain/customer/billingKnowledge'
import type { Customer } from '../../domain/customer/entity'
import type { RepositorySet } from '../../domain/repositorySet'

/** 締めの画面で選べる請求先を示すため。 */
export async function listBillingCustomers(repositories: RepositorySet): Promise<readonly Customer[]> {
  const customers = await repositories.customerRepository.listCustomers()
  const billingCustomers = selectBillingCustomers(customers)
  return billingCustomers
}
