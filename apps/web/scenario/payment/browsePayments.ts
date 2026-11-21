import { defineScenario } from '@app/flow'
import { accountant } from '../../role/role'

export const browsePayments = defineScenario('browsePayments', {
  actor: accountant,
  operate: async (screen) => {
    await screen.go('paymentList')
  },
  confirm: async (screen) => {
    await screen.expectHeading('paymentList')
  },
})
