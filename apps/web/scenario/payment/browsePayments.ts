import { defineScenario } from '@app/flow'

/** 入金の一覧で、仮受の入金と、請求に載せたかどうかを確かめるため。 */
export const browsePayments = defineScenario('browsePayments', {
  actor: 'accountant',
  operate: async (screen) => {
    await screen.go('paymentList')
  },
  confirm: async (screen) => {
    await screen.expectHeading('paymentList')
  },
})
