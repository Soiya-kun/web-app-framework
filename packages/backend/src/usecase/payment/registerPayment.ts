import { planPayerNameSaves } from '../../domain/payerName/payerNameSave'
import { decidePaymentCustomer } from '../../domain/payment/payerPolicy'
import { planPaymentCreate } from '../../domain/payment/paymentCreate'
import { interpretPaymentRequest, type PaymentRequest } from '../../domain/payment/paymentRequest'
import { assignPaymentId } from '../../domain/payment/value/paymentId'
import type { RepositorySet } from '../../domain/repositorySet'
import type { IdGenerator } from '../../domain/shared/idGenerator'
import type { PaymentCreate } from '../../domain/payment/paymentCreate'

/**
 * 入金を記録するため。顧客を選んでいなければ振込依頼人名で覚えた顧客にし、それもなければ仮受にする。
 * 顧客を選んだときは、その振込依頼人名を覚え、次から自動で特定する。
 */
export async function registerPayment(
  repositories: RepositorySet,
  idGenerator: IdGenerator,
  paymentRequest: PaymentRequest,
): Promise<PaymentCreate> {
  const paymentInput = interpretPaymentRequest(paymentRequest)
  const selectedCustomer = await repositories.customerRepository.findSelectedCustomer(paymentInput.customerId)
  const payerCustomer = await repositories.payerNameRepository.findPayerCustomer(paymentInput.payerName)
  const customerId = decidePaymentCustomer(selectedCustomer, payerCustomer)
  const paymentId = assignPaymentId(idGenerator)
  const paymentCreate = planPaymentCreate(paymentId, paymentInput, customerId)
  await repositories.paymentRepository.createPayment(paymentCreate)
  const payerNameSaves = planPayerNameSaves(paymentInput.payerName, selectedCustomer)
  await repositories.payerNameRepository.savePayerNames(payerNameSaves)
  return paymentCreate
}
