import { defineEstimate } from '@app/flow'
import { monthlyInvoice } from '../flow/invoice/monthlyInvoice'
import { paymentManagement } from '../flow/payment/paymentManagement'
import { legacyInvoice, legacyPayment, legacySales } from '../legacy/table'
import { createCustomer } from '../scenario/customer/createCustomer'
import { browseInvoice } from '../scenario/invoice/browseInvoice'
import { browseOverdueInvoices } from '../scenario/invoice/browseOverdueInvoices'
import { cancelClosing } from '../scenario/invoice/cancelClosing'
import { closeInvoice } from '../scenario/invoice/closeInvoice'
import { issueInvoice } from '../scenario/invoice/issueInvoice'
import { browsePayments } from '../scenario/payment/browsePayments'
import { createRefund } from '../scenario/payment/createRefund'
import { identifyPayment } from '../scenario/payment/identifyPayment'
import { registerPayment } from '../scenario/payment/registerPayment'
import { createSales } from '../scenario/sales/createSales'
import { SalesCreatePage } from '../src/sales/salesCreatePage'

export const estimate20261031 = defineEstimate('2026-10-31', {
  title: '見積（第3回の打合せのあと）',
  rate: 80_000,
  items: [
    { title: '要件定義（打合せ・議事録）', amount: 1_000_000 },
    { title: '売上の登録', amount: 400_000, targets: [createSales, SalesCreatePage] },
    { title: '請求の締めと締めの取消', amount: 800_000, targets: [closeInvoice, cancelClosing] },
    { title: '請求の閲覧と発行', amount: 600_000, targets: [browseInvoice, issueInvoice] },
    { title: '期日超過の請求の閲覧', amount: 300_000, targets: [browseOverdueInvoices] },
    { title: '入金の記録と特定', amount: 800_000, targets: [registerPayment, identifyPayment, browsePayments] },
    { title: '返金の登録', amount: 400_000, targets: [createRefund] },
    { title: '顧客の登録', amount: 300_000, targets: [createCustomer] },
    { title: '業務フローの E2E', amount: 600_000, targets: [monthlyInvoice, paymentManagement] },
    { title: '旧システムのデータの移行', amount: 900_000, targets: [legacySales, legacyInvoice, legacyPayment] },
    { title: '出精値引', amount: -300_000 },
  ],
})
