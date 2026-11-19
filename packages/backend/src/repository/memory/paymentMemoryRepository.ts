import { restorePayment, restorePaymentListItem } from '../../domain/payment/entity'
import type { PaymentRepository } from '../../domain/payment/paymentRepository'
import { ConflictError, NotFoundError } from '../../domain/shared/error'
import type { MemoryDatabase } from './memoryDatabase'

export function preparePaymentMemoryRepository(database: MemoryDatabase): PaymentRepository {
  return {
    async createPayment(paymentCreate) {
      // 本物の DB の主キー制約と同じく、同じ ID の行は保存しない。
      if (database.payment.some((row) => row.paymentId === paymentCreate.paymentId)) {
        throw new ConflictError('duplicateTarget')
      }
      database.payment.push({ ...paymentCreate, invoiceId: null })
    },
    async findPayment(paymentId) {
      const row = database.payment.find((paymentRow) => paymentRow.paymentId === paymentId)
      if (row === undefined) {
        throw new NotFoundError('missingTarget')
      }
      return restorePayment(row)
    },
    async listPayments() {
      return database.payment
        .toSorted((left, right) => right.paymentDate.localeCompare(left.paymentDate) || left.paymentId.localeCompare(right.paymentId))
        .map((row) => {
          const customer = database.customer.find((customerRow) => customerRow.customerId === row.customerId)
          return restorePaymentListItem({ ...row, customerName: customer?.customerName ?? null })
        })
    },
    async identifyPayment(paymentIdentify) {
      const index = database.payment.findIndex(
        (row) => row.paymentId === paymentIdentify.paymentId && row.customerId === null && row.invoiceId === null,
      )
      const row = database.payment[index]
      if (row === undefined) {
        throw new ConflictError('identifiedPayment')
      }
      database.payment[index] = { ...row, customerId: paymentIdentify.customerId }
    },
  }
}
