import { decide, defineMeeting, raise } from '@app/flow'
import { customerCreation } from '../flow/customer/customerCreation'
import { monthlyInvoice } from '../flow/invoice/monthlyInvoice'
import { overpayment } from '../flow/payment/overpayment'
import { paymentManagement } from '../flow/payment/paymentManagement'
import { transferFeeDeduction } from '../flow/payment/transferFeeDeduction'
import { accountant, approver, engineer, projectManager, salesperson } from '../role/role'

export const meeting20261003 = defineMeeting('2026-10-03', {
  title: 'キックオフ（業務フローの洗い出し）',
  attendees: [projectManager, engineer, accountant, salesperson, approver],
  agenda: [monthlyInvoice, paymentManagement, customerCreation],
  decisions: [
    decide(monthlyInvoice, '請求書は月末締めで、前回からの残高を繰り越す合計請求書にする。入金を個々の請求に充てる消込はしない'),
    decide(monthlyInvoice, '子会社の売上は、請求先にした親会社へまとめて請求する'),
  ],
  questions: {
    overpaymentHandling: raise(overpayment, '請求より多く入金されたとき、次の請求で差し引くか、振込人へ返金するかを、どう決めるか', {
      assignee: accountant,
      deadline: '2026-10-17',
    }),
    transferFeeAdjustment: raise(transferFeeDeduction, '振込手数料を差し引いて入金されたとき、当社の負担として残高から減らしてよいか', {
      assignee: approver,
      deadline: '2026-10-17',
    }),
    customerCreation: raise(customerCreation, '顧客（請求先・締日・回収条件）は、どの部署が登録し、変更するか', {
      assignee: salesperson,
      deadline: '2026-10-17',
    }),
  },
})
