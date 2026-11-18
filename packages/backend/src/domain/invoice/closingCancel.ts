import type { Brand } from '../shared/brand'
import { ConflictError } from '../shared/error'
import type { Invoice } from './entity'
import type { InvoiceId } from './value/invoiceId'

/** 締めの取消で消す請求。載せた行の invoice_id を空に戻し、請求の行を消す。 */
export type ClosingCancel = Brand<{ readonly invoiceId: InvoiceId }, 'ClosingCancel'>

/**
 * 締めを取り消してよいかを確かめるため。発行した請求は取り消さない（訂正は次の請求で行う）。
 * 次の締めは前回の発行を求めるので、発行前の請求はいつもその請求先の最新の請求になる。
 */
export function ensureClosingCancelable(invoice: Invoice): void {
  if (invoice.issueDate !== null) {
    throw new ConflictError('issuedInvoice')
  }
}

export function planClosingCancel(invoice: Invoice): ClosingCancel {
  return { invoiceId: invoice.invoiceId } as ClosingCancel
}
