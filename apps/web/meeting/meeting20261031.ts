import { answer, decide, defineMeeting, raise } from '@app/flow'
import { issuedInvoiceCorrection } from '../flow/invoice/issuedInvoiceCorrection'
import { overdueInvoice } from '../flow/invoice/overdueInvoice'
import { backdatedSales } from '../flow/sales/backdatedSales'
import { accountant, approver, engineer, projectManager, salesperson } from '../role/role'
import { meeting20261003 } from './meeting20261003'
import { meeting20261017 } from './meeting20261017'

// 業務部門の承認はまだ（未承認）。
export const meeting20261031 = defineMeeting('2026-10-31', {
  title: '第3回（請求の訂正と期日）',
  attendees: [projectManager, engineer, accountant, salesperson, approver],
  agenda: [issuedInvoiceCorrection, overdueInvoice, backdatedSales],
  answers: [
    answer(meeting20261003.questions.customerCreation, '顧客は営業担当が登録し、締日・回収条件の変更は経理担当が確かめる'),
    answer(meeting20261017.questions.mistakenRefund, '他社宛の誤入金の返金は、承認者の承認を要する'),
  ],
  decisions: [
    decide(issuedInvoiceCorrection, '発行した請求は変えず、誤りは次の請求で値引の売上か調整（訂正）として直す'),
    decide(backdatedSales, '締めた後に登録した、締め日以前の売上は、次の締めに載せる'),
  ],
  questions: {
    overdueReminder: raise(overdueInvoice, '入金期日を過ぎた請求先へ、期日の何日後に督促状を送るか', {
      assignee: accountant,
      deadline: '2026-11-14',
    }),
  },
})
