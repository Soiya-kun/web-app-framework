import { defineScenario } from '@app/flow'
import type { InvoiceTarget } from './browseInvoice'

/** 発行前の請求の締めを取り消し、載せた行を請求に載せる前へ戻すため（締め直すとき）。 */
export const cancelClosing = defineScenario('cancelClosing', {
  actor: 'accountant',
  operate: async (screen, invoice: InvoiceTarget) => {
    await screen.go('invoiceList')
    await screen.row(invoice.closingDate, invoice.billingCustomer).follow(invoice.closingDate)
    await screen.press('closingCancel')
  },
  confirm: async (screen) => {
    await screen.expectHeading('invoiceList')
  },
})
