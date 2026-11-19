import type { PaymentListItem } from '../../domain/payment/entity'
import type { RepositorySet } from '../../domain/repositorySet'

/** 入金を、顧客（仮受を含む）と請求に載せたかどうかとともに示すため。 */
export async function listPayments(repositories: RepositorySet): Promise<readonly PaymentListItem[]> {
  const payments = await repositories.paymentRepository.listPayments()
  return payments
}
