import type { Brand } from '../../shared/brand'
import { rejectValue } from '../../shared/validation'

/** 売上として計上する金額（円・税込）。 */
export type SalesAmount = Brand<number, 'SalesAmount'>

export const minimumSalesAmount = 1
export const maximumSalesAmount = 999_999_999

/** 画面から入力された金額を、売上金額として受け付けるため。 */
export function interpretSalesAmount(text: string): SalesAmount {
  const trimmedText = text.trim()
  if (trimmedText === '') {
    throw rejectValue('inputRequired')
  }
  if (!/^\d+$/.test(trimmedText)) {
    throw rejectValue('integerRequired')
  }
  const amount = Number(trimmedText)
  if (amount < minimumSalesAmount || amount > maximumSalesAmount) {
    throw rejectValue('invalidRange', { minimum: minimumSalesAmount, maximum: maximumSalesAmount })
  }
  return amount as SalesAmount
}
