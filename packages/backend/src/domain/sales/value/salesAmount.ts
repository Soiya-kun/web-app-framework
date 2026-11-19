import type { Brand } from '../../shared/brand'
import { rejectValue } from '../../shared/validation'

/** 売上の金額（円・税抜）。返品・値引は負で持つ。 */
export type SalesAmount = Brand<number, 'SalesAmount'>

export const minimumSalesAmount = 1
export const maximumSalesAmount = 999_999_999

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
