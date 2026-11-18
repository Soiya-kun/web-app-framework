import type { CustomerId } from '../customer/value/customerId'
import type { ClosingCancel } from './closingCancel'
import type { Invoice, InvoiceDetail, InvoiceListItem, UnbilledEntries } from './entity'
import type { InvoiceCreate } from './invoiceCreate'
import type { InvoiceIssue } from './invoiceIssue'
import type { ClosingDate } from './value/closingDate'
import type { InvoiceId } from './value/invoiceId'

export type InvoiceRepository = {
  /** 見つからなければ NotFoundError にする。 */
  findInvoice(invoiceId: InvoiceId): Promise<Invoice>
  /** 請求先の、締め日がいちばん新しい請求。まだなければ undefined。 */
  findLatestInvoice(billingCustomerId: CustomerId): Promise<Invoice | undefined>
  listInvoices(): Promise<readonly InvoiceListItem[]>
  /** 見つからなければ NotFoundError にする。 */
  findInvoiceDetail(invoiceId: InvoiceId): Promise<InvoiceDetail>
  /** 請求締め日までの、まだどの請求にも載せていない行。締めが終わるまで、ほかの操作で変えられないようにする。 */
  listUnbilledEntries(billingCustomerId: CustomerId, closingDate: ClosingDate): Promise<UnbilledEntries>
  /** 請求を保存し、行を請求に載せる。行がほかの操作で先に載っていたら ConflictError にする。 */
  createInvoice(invoiceCreate: InvoiceCreate): Promise<void>
  /** 発行した年の通し番号を1つ進めて返す。トランザクションを取り消せば番号も戻る（欠番にならない）。 */
  takeInvoiceNumber(issueYear: number): Promise<number>
  /** 発行前の請求に番号と発行日を入れる。すでに発行されていたら ConflictError にする。 */
  issueInvoice(invoiceIssue: InvoiceIssue): Promise<void>
  /** 発行前の請求を消し、載せた行を戻す。すでに発行されていたら ConflictError にする。 */
  cancelClosing(closingCancel: ClosingCancel): Promise<void>
}
