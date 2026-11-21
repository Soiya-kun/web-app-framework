import { defineLegacyFlow, elapse, operateLegacy, outside } from '@app/flow'
import { monthlyInvoice } from '../../flow/invoice/monthlyInvoice'
import { accountant } from '../../role/role'
import { closeInvoice } from '../../scenario/invoice/closeInvoice'
import { issueInvoice } from '../../scenario/invoice/issueInvoice'
import { registerPayment } from '../../scenario/payment/registerPayment'
import { createSales } from '../../scenario/sales/createSales'
import { deliverProduct, payInvoice, sendInvoice } from '../../step/step'
import { legacyInvoice, legacyPayment, legacySales } from '../table'

export const legacyMonthlyInvoice = defineLegacyFlow('legacyMonthlyInvoice', {
  replacement: monthlyInvoice,
  steps: [
    deliverProduct,
    operateLegacy(accountant, 'enterSales', {
      tables: [legacySales],
      replacement: createSales,
      operate: async (screen) => {
        await screen.go('売上伝票入力')
        await screen.fill('得意先コード', '000123')
        await screen.fill('売上日', '20261015')
        await screen.fill('品名', '運賃')
        await screen.fill('金額', '100000')
        await screen.press('登録(F12)')
      },
      confirm: async (screen) => {
        await screen.expectText('登録しました')
      },
    }),
    elapse('closingDate'),
    operateLegacy(accountant, 'printInvoice', {
      tables: [legacySales, legacyInvoice],
      replacement: [closeInvoice, issueInvoice],
      operate: async (screen) => {
        await screen.go('請求書発行')
        await screen.fill('締め日', '20261031')
        await screen.press('印刷(F10)')
      },
    }),
    outside(accountant, 'copyInvoice'),
    outside(accountant, 'mailInvoice', { replacement: sendInvoice }),
    payInvoice,
    operateLegacy(accountant, 'enterPayment', {
      tables: [legacyPayment],
      replacement: registerPayment,
      operate: async (screen) => {
        await screen.go('入金入力')
        await screen.fill('入金日', '20261120')
        await screen.fill('得意先コード', '000100')
        await screen.fill('入金額', '110000')
        await screen.fill('振込手数料', '0')
        await screen.press('登録(F12)')
      },
    }),
  ],
})
