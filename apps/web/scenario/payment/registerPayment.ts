import { defineScenario } from '@app/flow'

/** 入金登録の画面に入れる値。顧客が空なら、振込依頼人名から自動で特定させる。 */
export type PaymentInput = {
  readonly paymentDate: string
  readonly paymentAmount: string
  readonly payerName: string
  readonly customer: string
}

export const registerPayment = defineScenario('registerPayment', {
  actor: 'accountant',
  operate: async (screen, payment: PaymentInput) => {
    await screen.go('paymentCreate')
    await screen.fill('paymentDate', payment.paymentDate)
    await screen.fill('paymentAmount', payment.paymentAmount)
    await screen.fill('payerName', payment.payerName)
    await screen.choose('customer', payment.customer)
    await screen.press('register')
  },
  confirm: async (screen, payment) => {
    await screen.expectMessage('paymentIdentified', { customer: payment.customer })
  },
  extensions: {
    unidentifiedPayer: {
      condition: '振込依頼人名から顧客を特定できない',
      confirm: async (screen) => {
        await screen.expectMessage('unidentifiedPayment')
      },
    },
    invalidPaymentAmount: { condition: '入金額が空か、1 から 999,999,999 の整数でない' },
    invalidPayerName: { condition: '振込依頼人名が空か、100 文字を超える' },
    invalidPaymentDate: { condition: '入金日が実在する日付でない' },
  },
})
