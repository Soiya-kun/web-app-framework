import { defineScenario } from '@app/flow'
import { accountant } from '../../role/role'

/** 仮受の入金と、特定した顧客。 */
export type IdentifyInput = {
  readonly payerName: string
  readonly customer: string
}

export const identifyPayment = defineScenario('identifyPayment', {
  actor: accountant,
  operate: async (screen, identify: IdentifyInput) => {
    await screen.go('paymentList')
    await screen.row(identify.payerName).choose('customer', identify.customer)
    await screen.row(identify.payerName).press('identify')
  },
  confirm: async (screen) => {
    await screen.expectMessage('identifyCompleted')
  },
})
