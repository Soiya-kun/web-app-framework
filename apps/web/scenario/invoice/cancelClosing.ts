import { defineScenario } from '@app/flow'
import type { InvoiceTarget } from './browseInvoice'

export const cancelClosing = defineScenario('cancelClosing', {
  actor: 'accountant',
  operate: async (screen, invoice: InvoiceTarget) => {
    await screen.go('invoiceList')
    await screen.rowOf('invoiceList', { closingDate: invoice.closingDate, billingCustomer: invoice.billingCustomer }).follow(invoice.closingDate)
    await screen.press('closingCancel')
  },
  confirm: async (screen) => {
    await screen.expectHeading('invoiceList')
  },
})
