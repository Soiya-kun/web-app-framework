import { defineScenario, type CellExpectation } from '@app/flow'
import { accountant } from '../../role/role'

/** 請求の締めの画面に入れる値と、締めたあとの請求の内訳で確かめる金額。 */
export type ClosingInput = {
  readonly billingCustomer: string
  readonly closingDate: string
  readonly breakdown?: CellExpectation
}

export const closeInvoice = defineScenario('closeInvoice', {
  actor: accountant,
  operate: async (screen, closing: ClosingInput) => {
    await screen.go('invoiceClosing')
    await screen.choose('billingCustomer', closing.billingCustomer)
    await screen.fill('closingDate', closing.closingDate)
    await screen.press('close')
  },
  confirm: async (screen, closing) => {
    await screen.expectHeading('invoiceDetail')
    await screen.expectCells('invoiceBreakdown', closing.breakdown ?? {})
  },
  extensions: {
    invalidClosingDay: { condition: '請求締め日が、請求先の締日に合っていない' },
    unissuedPreviousInvoice: { condition: '前回の請求がまだ発行されていない' },
    earlyClosingDate: { condition: '請求締め日が、前回の請求締め日以前' },
    emptyClosing: { condition: '前回からの残高も、請求に載せる行もない' },
    invalidFields: { condition: '請求先か請求締め日がない、または請求締め日が実在しない' },
  },
})
