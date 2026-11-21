import { defineScenario } from '@app/flow'
import { accountant } from '../../role/role'

/** 発行する請求と発行日。 */
export type IssueInput = {
  readonly billingCustomer: string
  readonly closingDate: string
  readonly issueDate: string
}

export const issueInvoice = defineScenario('issueInvoice', {
  actor: accountant,
  operate: async (screen, issue: IssueInput) => {
    await screen.go('invoiceList')
    await screen.rowOf('invoiceList', { closingDate: issue.closingDate, billingCustomer: issue.billingCustomer }).follow(issue.closingDate)
    await screen.fill('issueDate', issue.issueDate)
    await screen.press('issue')
  },
  confirm: async (screen) => {
    await screen.expectMessage('issueCompleted')
  },
  extensions: {
    earlyIssueDate: { condition: '発行日が請求締め日より前' },
  },
})
