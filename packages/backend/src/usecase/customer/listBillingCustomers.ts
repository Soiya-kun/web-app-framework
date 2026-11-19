import { selectBillingCustomers } from '../../domain/customer/billingKnowledge'
import type { Customer } from '../../domain/customer/entity'
import type { RepositorySet } from '../../domain/repositorySet'

export async function listBillingCustomers(repositories: RepositorySet): Promise<readonly Customer[]> {
  const customers = await repositories.customerRepository.listCustomers()
  const billingCustomers = selectBillingCustomers(customers)
  return billingCustomers
}
