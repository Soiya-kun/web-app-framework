import { defineScenario } from '@app/flow'

/** 請求一覧から開く請求（請求先と請求締め日で選ぶ）。 */
export type InvoiceTarget = {
  readonly billingCustomer: string
  readonly closingDate: string
}

/** 締めた請求の内容（残高を繰り越す請求書の金額と、載せた行）を、発行する前に確かめるため。 */
export const browseInvoice = defineScenario('browseInvoice', {
  actor: 'accountant',
  operate: async (screen, invoice: InvoiceTarget) => {
    await screen.go('invoiceList')
    await screen.row(invoice.closingDate, invoice.billingCustomer).follow(invoice.closingDate)
  },
  confirm: async (screen) => {
    await screen.expectHeading('invoiceDetail')
  },
  extensions: {
    mistakenInvoice: { condition: '請求の内容に誤りがある（締め日までの売上の登録漏れなど）' },
  },
})
