import { defineFlow, elapse, occur, operate, outside } from '@app/flow'
import type { MemoryDatabase } from '@app/backend/testing'
import { issuedOctoberSeed } from '../../test/billingSeed'
import { browseOverdueInvoices } from '../../scenario/invoice/browseOverdueInvoices'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { registerPayment } from '../../scenario/payment/registerPayment'
import { accountant, customer } from '../../role/role'

export const overdueInvoice = defineFlow<Partial<MemoryDatabase>>('overdueInvoice', {
  precondition: { summary: '親会社の10月の請求（今回請求額 110,000 円、入金期日 2026-11-30）を発行済みで、入金はまだない', seed: issuedOctoberSeed },
  steps: [
    elapse('closingDate', '2026-11-30'),
    // 入金がないまま締めると、10月の請求額が繰越額として残る。
    operate(closeInvoice, {
      billingCustomer: '株式会社親',
      closingDate: '2026-11-30',
      breakdown: { previousInvoiceAmount: 110_000, currentPaymentAmount: 0, carriedAmount: 110_000, currentInvoiceAmount: 110_000 },
    }),
    operate(browseOverdueInvoices),
    outside(accountant, 'sendReminder'),
    occur(customer, 'payInvoice'),
    operate(registerPayment, { paymentDate: '2026-12-05', paymentAmount: '110000', payerName: 'カ)オヤ', customer: '株式会社親' }),
  ],
})
