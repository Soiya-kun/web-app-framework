import { decide, defineMeeting, extensionOf, raise } from '@app/flow'
import { closeInvoice } from '../../../packages/backend/src/usecase/invoice/closeInvoice'
import { customerCreation } from '../flow/customer/customerCreation'
import { issuedInvoiceCorrection } from '../flow/invoice/issuedInvoiceCorrection'
import { overdueInvoice } from '../flow/invoice/overdueInvoice'
import { backdatedSales } from '../flow/sales/backdatedSales'
import { accountant, approver, engineer, projectManager, salesperson } from '../role/role'
import { createAdjustment } from '../scenario/payment/createAdjustment'
import { registerPayment } from '../scenario/payment/registerPayment'
import { meeting20261003 } from './meeting20261003'
import { meeting20261017 } from './meeting20261017'

export const meeting20261031 = defineMeeting('2026-10-31', {
  title: '第3回（請求の訂正と期日）',
  attendees: [projectManager, engineer, accountant, salesperson, approver],
  agenda: [issuedInvoiceCorrection, overdueInvoice, backdatedSales],
  decisions: [
    decide(customerCreation, '顧客は営業担当が登録し、締日・回収条件の変更は経理担当が確かめる', {
      question: meeting20261003.questions.customerCreation,
    }),
    decide(extensionOf(registerPayment, 'mistakenPayment'), '他社宛の誤入金の返金は、承認者の承認を要する', {
      question: meeting20261017.questions.mistakenRefund,
    }),
    decide([issuedInvoiceCorrection, createAdjustment], '発行した請求は変えず、誤りは次の請求で値引の売上か調整（訂正）として直す'),
    decide([backdatedSales, closeInvoice], '締めた後に登録した、締め日以前の売上は、次の締めに載せる'),
  ],
  questions: {
    overdueReminder: raise(overdueInvoice, '入金期日を過ぎた請求先へ、期日の何日後に督促状を送るか', {
      assignee: accountant,
      deadline: '2026-11-14',
    }),
  },
})
