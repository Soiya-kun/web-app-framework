import type { PaymentListItem } from '../../domain/payment/entity'
import type { RepositorySet } from '../../domain/repositorySet'

export async function listPayments(repositories: RepositorySet): Promise<readonly PaymentListItem[]> {
  const payments = await repositories.paymentRepository.listPayments()
  return payments
}
