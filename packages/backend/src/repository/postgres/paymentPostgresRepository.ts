import { restorePayment, restorePaymentListItem } from '../../domain/payment/entity'
import type { PaymentRepository } from '../../domain/payment/paymentRepository'
import { ConflictError, NotFoundError } from '../../domain/shared/error'
import { createPaymentStatement, findPaymentStatement, identifyPaymentStatement, listPaymentsStatement } from './paymentStatement'
import type { Executor } from './statement'

export function preparePaymentPostgresRepository(executor: Executor): PaymentRepository {
  return {
    async createPayment(paymentCreate) {
      await executor.execute(createPaymentStatement, [
        paymentCreate.paymentId,
        paymentCreate.paymentDate,
        paymentCreate.paymentMethod,
        paymentCreate.paymentAmount,
        paymentCreate.payerName,
        paymentCreate.customerId,
      ])
    },
    async findPayment(paymentId) {
      const [row] = await executor.execute(findPaymentStatement, [paymentId])
      if (row === undefined) {
        throw new NotFoundError('missingTarget')
      }
      return restorePayment(row)
    },
    async listPayments() {
      const rows = await executor.execute(listPaymentsStatement, [])
      return rows.map(restorePaymentListItem)
    },
    async identifyPayment(paymentIdentify) {
      const rows = await executor.execute(identifyPaymentStatement, [paymentIdentify.paymentId, paymentIdentify.customerId])
      if (rows.length === 0) {
        throw new ConflictError('identifiedPayment')
      }
    },
  }
}
