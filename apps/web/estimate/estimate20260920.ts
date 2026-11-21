import { defineEstimate } from '@app/flow'
import { customerCreation } from '../flow/customer/customerCreation'
import { monthlyInvoice } from '../flow/invoice/monthlyInvoice'
import { paymentManagement } from '../flow/payment/paymentManagement'
import { legacyMonthlyInvoice } from '../legacy/invoice/legacyMonthlyInvoice'

export const estimate20260920 = defineEstimate('2026-09-20', {
  title: '概算見積',
  items: [
    { title: '要件定義', amount: 1_200_000 },
    { title: '月次の請求（売上・締め・発行）', amount: 2_400_000, targets: [monthlyInvoice] },
    { title: '入金の管理', amount: 1_600_000, targets: [paymentManagement] },
    { title: '顧客の登録', amount: 400_000, targets: [customerCreation] },
    { title: '現行の請求業務からの移行', amount: 800_000, targets: [legacyMonthlyInvoice] },
  ],
})
