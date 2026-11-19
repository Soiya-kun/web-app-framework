import { restoreAdjustment } from '../../domain/adjustment/entity'
import type { CustomerId } from '../../domain/customer/value/customerId'
import { restoreInvoice, restoreInvoiceListItem, restoreInvoiceTax } from '../../domain/invoice/entity'
import type { InvoiceRepository } from '../../domain/invoice/invoiceRepository'
import type { InvoiceId } from '../../domain/invoice/value/invoiceId'
import { restorePayment } from '../../domain/payment/entity'
import { restoreRefund } from '../../domain/refund/entity'
import { restoreSales } from '../../domain/sales/entity'
import { ConflictError, NotFoundError } from '../../domain/shared/error'
import type { MemoryDatabase } from './memoryDatabase'

type BilledRow = { readonly invoiceId: string | null }

/** 行を請求に載せる。本物の DB の「invoice_id IS NULL の行だけ更新する」と同じく、載せ済みの行があれば止める。 */
function billRows<Row extends BilledRow>(rows: Row[], readId: (row: Row) => string, ids: readonly string[], invoiceId: string): void {
  for (const id of ids) {
    const index = rows.findIndex((row) => readId(row) === id)
    const row = rows[index]
    if (row === undefined || row.invoiceId !== null) {
      throw new ConflictError('changedTarget')
    }
    rows[index] = { ...row, invoiceId }
  }
}

/** 請求に載せた行を、載せる前に戻す。 */
function detachRows<Row extends BilledRow>(rows: Row[], invoiceId: string): void {
  rows.forEach((row, index) => {
    if (row.invoiceId === invoiceId) {
      rows[index] = { ...row, invoiceId: null }
    }
  })
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

export function prepareInvoiceMemoryRepository(database: MemoryDatabase): InvoiceRepository {
  function findInvoiceRow(invoiceId: InvoiceId): (typeof database.invoice)[number] {
    const row = database.invoice.find((invoiceRow) => invoiceRow.invoiceId === invoiceId)
    if (row === undefined) {
      throw new NotFoundError('missingTarget')
    }
    return row
  }

  function attachCustomerName(row: (typeof database.invoice)[number]) {
    const customer = database.customer.find((customerRow) => customerRow.customerId === row.billingCustomerId)
    return restoreInvoiceListItem({ ...row, billingCustomerName: customer?.customerName ?? '' })
  }

  function listMemberIds(billingCustomerId: CustomerId): Set<string> {
    return new Set(
      database.customer.filter((row) => row.billingCustomerId === billingCustomerId).map((row) => row.customerId),
    )
  }

  return {
    async findInvoice(invoiceId) {
      return restoreInvoice(findInvoiceRow(invoiceId))
    },
    async findLatestInvoice(billingCustomerId) {
      const [latest] = database.invoice
        .filter((row) => row.billingCustomerId === billingCustomerId)
        .toSorted((left, right) => compareText(right.closingDate, left.closingDate))
      return latest === undefined ? undefined : restoreInvoice(latest)
    },
    async listInvoices() {
      return database.invoice
        .toSorted(
          (left, right) =>
            compareText(right.closingDate, left.closingDate) || compareText(left.billingCustomerId, right.billingCustomerId),
        )
        .map(attachCustomerName)
    },
    async findInvoiceDetail(invoiceId) {
      const row = findInvoiceRow(invoiceId)
      return {
        invoice: attachCustomerName(row),
        taxes: database.invoiceTax
          .filter((tax) => tax.invoiceId === invoiceId)
          .toSorted((left, right) => right.taxRate - left.taxRate)
          .map(restoreInvoiceTax),
        sales: database.sales
          .filter((sales) => sales.invoiceId === invoiceId)
          .toSorted((left, right) => compareText(left.salesDate, right.salesDate) || compareText(left.salesId, right.salesId))
          .map(restoreSales),
        payments: database.payment
          .filter((payment) => payment.invoiceId === invoiceId)
          .toSorted((left, right) => compareText(left.paymentDate, right.paymentDate) || compareText(left.paymentId, right.paymentId))
          .map(restorePayment),
        refunds: database.refund
          .filter((refund) => refund.invoiceId === invoiceId)
          .toSorted((left, right) => compareText(left.refundDate, right.refundDate) || compareText(left.refundId, right.refundId))
          .map(restoreRefund),
        adjustments: database.adjustment
          .filter((adjustment) => adjustment.invoiceId === invoiceId)
          .toSorted(
            (left, right) =>
              compareText(left.adjustmentDate, right.adjustmentDate) || compareText(left.adjustmentId, right.adjustmentId),
          )
          .map(restoreAdjustment),
      }
    },
    async listUnbilledEntries(billingCustomerId, closingDate) {
      const memberIds = listMemberIds(billingCustomerId)
      const paymentIds = new Set(
        database.payment.filter((payment) => payment.customerId === billingCustomerId).map((payment) => payment.paymentId),
      )
      return {
        sales: database.sales
          .filter((sales) => memberIds.has(sales.customerId) && sales.invoiceId === null && sales.salesDate <= closingDate)
          .toSorted((left, right) => compareText(left.salesDate, right.salesDate) || compareText(left.salesId, right.salesId))
          .map(restoreSales),
        payments: database.payment
          .filter(
            (payment) => payment.customerId === billingCustomerId && payment.invoiceId === null && payment.paymentDate <= closingDate,
          )
          .toSorted((left, right) => compareText(left.paymentDate, right.paymentDate) || compareText(left.paymentId, right.paymentId))
          .map(restorePayment),
        refunds: database.refund
          .filter((refund) => paymentIds.has(refund.paymentId) && refund.invoiceId === null && refund.refundDate <= closingDate)
          .toSorted((left, right) => compareText(left.refundDate, right.refundDate) || compareText(left.refundId, right.refundId))
          .map(restoreRefund),
        adjustments: database.adjustment
          .filter(
            (adjustment) =>
              adjustment.billingCustomerId === billingCustomerId &&
              adjustment.invoiceId === null &&
              adjustment.adjustmentDate <= closingDate,
          )
          .toSorted(
            (left, right) =>
              compareText(left.adjustmentDate, right.adjustmentDate) || compareText(left.adjustmentId, right.adjustmentId),
          )
          .map(restoreAdjustment),
      }
    },
    async createInvoice(invoiceCreate) {
      const invoice = invoiceCreate.invoice
      // 本物の DB の一意制約と同じ（同じ請求先・締め日、同じ前回の請求、同じ ID）。
      const isDuplicate = database.invoice.some(
        (row) =>
          row.invoiceId === invoice.invoiceId ||
          (row.billingCustomerId === invoice.billingCustomerId && row.closingDate === invoice.closingDate) ||
          (invoice.previousInvoiceId !== null && row.previousInvoiceId === invoice.previousInvoiceId),
      )
      if (isDuplicate) {
        throw new ConflictError('duplicateTarget')
      }
      database.invoice.push({ ...invoice })
      database.invoiceTax.push(...invoiceCreate.taxes.map((tax) => ({ ...tax })))
      billRows(database.sales, (row) => row.salesId, invoiceCreate.salesIds, invoice.invoiceId)
      billRows(database.payment, (row) => row.paymentId, invoiceCreate.paymentIds, invoice.invoiceId)
      billRows(database.refund, (row) => row.refundId, invoiceCreate.refundIds, invoice.invoiceId)
      billRows(database.adjustment, (row) => row.adjustmentId, invoiceCreate.adjustmentIds, invoice.invoiceId)
    },
    async takeInvoiceNumber(issueYear) {
      const index = database.invoiceCounter.findIndex((row) => row.issueYear === issueYear)
      const lastNumber = (database.invoiceCounter[index]?.lastNumber ?? 0) + 1
      if (index === -1) {
        database.invoiceCounter.push({ issueYear, lastNumber })
      } else {
        database.invoiceCounter[index] = { issueYear, lastNumber }
      }
      return lastNumber
    },
    async issueInvoice(invoiceIssue) {
      const index = database.invoice.findIndex((row) => row.invoiceId === invoiceIssue.invoiceId && row.issueDate === null)
      const row = database.invoice[index]
      if (row === undefined) {
        throw new ConflictError('issuedInvoice')
      }
      database.invoice[index] = { ...row, invoiceNumber: invoiceIssue.invoiceNumber, issueDate: invoiceIssue.issueDate }
    },
    async cancelClosing(closingCancel) {
      const index = database.invoice.findIndex((row) => row.invoiceId === closingCancel.invoiceId && row.issueDate === null)
      if (index === -1) {
        throw new ConflictError('issuedInvoice')
      }
      detachRows(database.sales, closingCancel.invoiceId)
      detachRows(database.payment, closingCancel.invoiceId)
      detachRows(database.refund, closingCancel.invoiceId)
      detachRows(database.adjustment, closingCancel.invoiceId)
      const remainingTaxes = database.invoiceTax.filter((tax) => tax.invoiceId !== closingCancel.invoiceId)
      database.invoiceTax.splice(0, database.invoiceTax.length, ...remainingTaxes)
      database.invoice.splice(index, 1)
    },
  }
}
