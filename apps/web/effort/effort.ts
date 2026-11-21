// 機能ごとの工数（人日）。audit は人が監査する工数（AI 開発の実際の工数）、manual は人がコーディングとテストをする場合の工数（営業の再見積用）。
import { defineEffort } from '@app/flow'
import { monthlyInvoice } from '../flow/invoice/monthlyInvoice'
import { legacyInvoice, legacyPayment, legacySales } from '../legacy/table'
import { createCustomer } from '../scenario/customer/createCustomer'
import { browseInvoice } from '../scenario/invoice/browseInvoice'
import { browseOverdueInvoices } from '../scenario/invoice/browseOverdueInvoices'
import { cancelClosing } from '../scenario/invoice/cancelClosing'
import { closeInvoice } from '../scenario/invoice/closeInvoice'
import { issueInvoice } from '../scenario/invoice/issueInvoice'
import { browsePayments } from '../scenario/payment/browsePayments'
import { createAdjustment } from '../scenario/payment/createAdjustment'
import { createRefund } from '../scenario/payment/createRefund'
import { identifyPayment } from '../scenario/payment/identifyPayment'
import { registerPayment } from '../scenario/payment/registerPayment'
import { createSales } from '../scenario/sales/createSales'

export const effort = defineEffort([
  { target: createSales, audit: 0.5, manual: 5 },
  { target: closeInvoice, audit: 1, manual: 8 },
  { target: cancelClosing, audit: 0.5, manual: 3 },
  { target: browseInvoice, audit: 0.25, manual: 3 },
  { target: issueInvoice, audit: 0.5, manual: 5 },
  { target: browseOverdueInvoices, audit: 0.25, manual: 3 },
  { target: registerPayment, audit: 0.5, manual: 6 },
  { target: identifyPayment, audit: 0.25, manual: 3 },
  { target: browsePayments, audit: 0.25, manual: 3 },
  { target: createRefund, audit: 0.5, manual: 4 },
  { target: createAdjustment, audit: 0.25, manual: 3 },
  { target: createCustomer, audit: 0.25, manual: 3 },
  { target: monthlyInvoice, audit: 1, manual: 5 },
  { target: legacySales, audit: 0.5, manual: 4 },
  { target: legacyInvoice, audit: 0.5, manual: 4 },
  { target: legacyPayment, audit: 0.5, manual: 4 },
])
