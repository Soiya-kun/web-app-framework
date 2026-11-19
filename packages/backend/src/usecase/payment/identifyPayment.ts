import { planPayerNameSaves } from '../../domain/payerName/payerNameSave'
import { interpretIdentifyRequest, type IdentifyRequest } from '../../domain/payment/identifyRequest'
import { ensurePaymentIdentifiable } from '../../domain/payment/payerPolicy'
import { planPaymentIdentify } from '../../domain/payment/paymentIdentify'
import type { RepositorySet } from '../../domain/repositorySet'

/** 振込人を特定できていない入金（仮受）に顧客を入れ、次の締めで請求に載るようにするため。振込依頼人名も覚える。 */
export async function identifyPayment(repositories: RepositorySet, identifyRequest: IdentifyRequest): Promise<void> {
  const identifyInput = interpretIdentifyRequest(identifyRequest)
  const payment = await repositories.paymentRepository.findPayment(identifyInput.paymentId)
  const customer = await repositories.customerRepository.findCustomer(identifyInput.customerId)
  ensurePaymentIdentifiable(payment, customer)
  const paymentIdentify = planPaymentIdentify(payment, customer)
  await repositories.paymentRepository.identifyPayment(paymentIdentify)
  const payerNameSaves = planPayerNameSaves(payment.payerName, customer)
  await repositories.payerNameRepository.savePayerNames(payerNameSaves)
}
