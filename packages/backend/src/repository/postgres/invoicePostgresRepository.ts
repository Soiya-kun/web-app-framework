import { restoreAdjustment } from '../../domain/adjustment/entity'
import { restoreInvoice, restoreInvoiceListItem, restoreInvoiceTax } from '../../domain/invoice/entity'
import type { InvoiceRepository } from '../../domain/invoice/invoiceRepository'
import { restorePayment } from '../../domain/payment/entity'
import { restoreRefund } from '../../domain/refund/entity'
import { restoreSales } from '../../domain/sales/entity'
import { ConflictError, NotFoundError } from '../../domain/shared/error'
import {
  billAdjustmentsStatement,
  billPaymentsStatement,
  billRefundsStatement,
  billSalesStatement,
  createInvoiceStatement,
  createInvoiceTaxesStatement,
  deleteInvoiceStatement,
  deleteInvoiceTaxesStatement,
  findInvoiceListItemStatement,
  findInvoiceStatement,
  findLatestInvoiceStatement,
  issueInvoiceStatement,
  listInvoiceAdjustmentsStatement,
  listInvoicePaymentsStatement,
  listInvoiceRefundsStatement,
  listInvoiceSalesStatement,
  listInvoicesStatement,
  listInvoiceTaxesStatement,
  listUnbilledAdjustmentsStatement,
  listUnbilledPaymentsStatement,
  listUnbilledRefundsStatement,
  listUnbilledSalesStatement,
  takeInvoiceNumberStatement,
  detachAdjustmentsStatement,
  detachPaymentsStatement,
  detachRefundsStatement,
  detachSalesStatement,
} from './invoiceStatement'
import type { Executor } from './statement'

/** 載せるはずの行が、ほかの操作で先に載っていた（更新した行の数が合わない）ときは止める。 */
function ensureAllBilled(billedRows: readonly unknown[], ids: readonly string[]): void {
  if (billedRows.length !== ids.length) {
    throw new ConflictError('changedTarget')
  }
}

export function prepareInvoicePostgresRepository(executor: Executor): InvoiceRepository {
  return {
    async findInvoice(invoiceId) {
      const [row] = await executor.execute(findInvoiceStatement, [invoiceId])
      if (row === undefined) {
        throw new NotFoundError('missingTarget')
      }
      return restoreInvoice(row)
    },
    async findLatestInvoice(billingCustomerId) {
      const [row] = await executor.execute(findLatestInvoiceStatement, [billingCustomerId])
      return row === undefined ? undefined : restoreInvoice(row)
    },
    async listInvoices() {
      const rows = await executor.execute(listInvoicesStatement, [])
      return rows.map(restoreInvoiceListItem)
    },
    async findInvoiceDetail(invoiceId) {
      const [row] = await executor.execute(findInvoiceListItemStatement, [invoiceId])
      if (row === undefined) {
        throw new NotFoundError('missingTarget')
      }
      const taxes = await executor.execute(listInvoiceTaxesStatement, [invoiceId])
      const sales = await executor.execute(listInvoiceSalesStatement, [invoiceId])
      const payments = await executor.execute(listInvoicePaymentsStatement, [invoiceId])
      const refunds = await executor.execute(listInvoiceRefundsStatement, [invoiceId])
      const adjustments = await executor.execute(listInvoiceAdjustmentsStatement, [invoiceId])
      return {
        invoice: restoreInvoiceListItem(row),
        taxes: taxes.map(restoreInvoiceTax),
        sales: sales.map(restoreSales),
        payments: payments.map(restorePayment),
        refunds: refunds.map(restoreRefund),
        adjustments: adjustments.map(restoreAdjustment),
      }
    },
    async listUnbilledEntries(billingCustomerId, closingDate) {
      const sales = await executor.execute(listUnbilledSalesStatement, [billingCustomerId, closingDate])
      const payments = await executor.execute(listUnbilledPaymentsStatement, [billingCustomerId, closingDate])
      const refunds = await executor.execute(listUnbilledRefundsStatement, [billingCustomerId, closingDate])
      const adjustments = await executor.execute(listUnbilledAdjustmentsStatement, [billingCustomerId, closingDate])
      return {
        sales: sales.map(restoreSales),
        payments: payments.map(restorePayment),
        refunds: refunds.map(restoreRefund),
        adjustments: adjustments.map(restoreAdjustment),
      }
    },
    async createInvoice(invoiceCreate) {
      const invoice = invoiceCreate.invoice
      await executor.execute(createInvoiceStatement, [
        invoice.invoiceId,
        invoice.billingCustomerId,
        invoice.previousInvoiceId,
        invoice.closingDate,
        invoice.dueDate,
        invoice.previousAmount,
        invoice.paymentAmount,
        invoice.adjustmentAmount,
        invoice.carriedAmount,
        invoice.salesAmount,
        invoice.taxAmount,
        invoice.invoiceAmount,
      ])
      await executor.execute(createInvoiceTaxesStatement, [
        invoice.invoiceId,
        invoiceCreate.taxes.map((tax) => tax.taxRate),
        invoiceCreate.taxes.map((tax) => tax.taxableAmount),
        invoiceCreate.taxes.map((tax) => tax.taxAmount),
      ])
      ensureAllBilled(await executor.execute(billSalesStatement, [invoice.invoiceId, invoiceCreate.salesIds]), invoiceCreate.salesIds)
      ensureAllBilled(
        await executor.execute(billPaymentsStatement, [invoice.invoiceId, invoiceCreate.paymentIds]),
        invoiceCreate.paymentIds,
      )
      ensureAllBilled(
        await executor.execute(billRefundsStatement, [invoice.invoiceId, invoiceCreate.refundIds]),
        invoiceCreate.refundIds,
      )
      ensureAllBilled(
        await executor.execute(billAdjustmentsStatement, [invoice.invoiceId, invoiceCreate.adjustmentIds]),
        invoiceCreate.adjustmentIds,
      )
    },
    async takeInvoiceNumber(issueYear) {
      const [row] = await executor.execute(takeInvoiceNumberStatement, [issueYear])
      if (row === undefined) {
        throw new Error('請求番号を採番できませんでした。')
      }
      return row.lastNumber
    },
    async issueInvoice(invoiceIssue) {
      const rows = await executor.execute(issueInvoiceStatement, [
        invoiceIssue.invoiceId,
        invoiceIssue.invoiceNumber,
        invoiceIssue.issueDate,
      ])
      if (rows.length === 0) {
        throw new ConflictError('issuedInvoice')
      }
    },
    async cancelClosing(closingCancel) {
      await executor.execute(detachSalesStatement, [closingCancel.invoiceId])
      await executor.execute(detachPaymentsStatement, [closingCancel.invoiceId])
      await executor.execute(detachRefundsStatement, [closingCancel.invoiceId])
      await executor.execute(detachAdjustmentsStatement, [closingCancel.invoiceId])
      await executor.execute(deleteInvoiceTaxesStatement, [closingCancel.invoiceId])
      const rows = await executor.execute(deleteInvoiceStatement, [closingCancel.invoiceId])
      if (rows.length === 0) {
        throw new ConflictError('issuedInvoice')
      }
    },
  }
}
