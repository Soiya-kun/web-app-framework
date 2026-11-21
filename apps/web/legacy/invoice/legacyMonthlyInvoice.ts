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
    operateLegacy(accountant, 'enterSales', { tables: [legacySales], replacement: createSales }),
    elapse('closingDate'),
    operateLegacy(accountant, 'printInvoice', { tables: [legacySales, legacyInvoice], replacement: [closeInvoice, issueInvoice] }),
    outside(accountant, 'copyInvoice'),
    outside(accountant, 'mailInvoice', { replacement: sendInvoice }),
    payInvoice,
    operateLegacy(accountant, 'enterPayment', { tables: [legacyPayment], replacement: registerPayment }),
  ],
})
