import { answer, decide, defineMeeting, extensionOf, raise } from '@app/flow'
import { overpaymentRefund } from '../flow/payment/overpaymentRefund'
import { paymentManagement } from '../flow/payment/paymentManagement'
import { transferFeeDeduction } from '../flow/payment/transferFeeDeduction'
import { accountant, approver, engineer, projectManager } from '../role/role'
import { createRefund } from '../scenario/payment/createRefund'
import { registerPayment } from '../scenario/payment/registerPayment'
import { meeting20261003 } from './meeting20261003'

export const meeting20261017 = defineMeeting('2026-10-17', {
  title: '第2回（入金の業務）',
  attendees: [projectManager, engineer, accountant, approver],
  agenda: [paymentManagement, overpaymentRefund, transferFeeDeduction, registerPayment],
  answers: [
    answer(meeting20261003.questions.overpaymentHandling, '請求先から返金の依頼があれば返金し、なければ次の請求で差し引く'),
    answer(meeting20261003.questions.transferFeeAdjustment, '振込手数料は当社の負担とし、調整（振込手数料）で残高から減らす'),
  ],
  decisions: [
    decide(extensionOf(registerPayment, 'unidentifiedPayer'), '振込人を特定できない入金は仮受にし、入金の一覧で顧客を特定する'),
    decide(paymentManagement, '顧客を選んで記録した振込依頼人名は覚え、次から自動で顧客を特定する'),
  ],
  questions: {
    mistakenRefund: raise(extensionOf(registerPayment, 'mistakenPayment'), '他社宛の誤入金を返金するとき、誰の承認が要るか', {
      assignee: approver,
      deadline: '2026-10-31',
    }),
    refundCreation: raise(createRefund, '返金を登録する画面で、振込先の口座まで入れるか、返金した日と金額だけにするか', {
      assignee: accountant,
      deadline: '2026-10-31',
    }),
  },
  approval: { on: '2026-10-20', by: approver },
})
