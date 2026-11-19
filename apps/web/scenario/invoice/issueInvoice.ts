import { defineScenario } from '@app/flow'

/** 発行する請求と発行日。 */
export type IssueInput = {
  readonly billingCustomer: string
  readonly closingDate: string
  readonly issueDate: string
}

/** 確かめた請求に請求番号を振り、変えられない請求書にするため。 */
export const issueInvoice = defineScenario('issueInvoice', {
  actor: 'accountant',
  operate: async (screen, issue: IssueInput) => {
    await screen.go('invoiceList')
    await screen.row(issue.closingDate, issue.billingCustomer).follow(issue.closingDate)
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
