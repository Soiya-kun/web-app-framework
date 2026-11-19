import { rejectValue } from '../../shared/validation'
import type { Yen } from '../../shared/yen'

export const minimumPaymentAmount = 1
export const maximumPaymentAmount = 999_999_999

export function interpretPaymentAmount(text: string): Yen {
  const trimmedText = text.trim()
  if (trimmedText === '') {
    throw rejectValue('inputRequired')
  }
  if (!/^\d+$/.test(trimmedText)) {
    throw rejectValue('integerRequired')
  }
  const amount = Number(trimmedText)
  if (amount < minimumPaymentAmount || amount > maximumPaymentAmount) {
    throw rejectValue('invalidRange', { minimum: minimumPaymentAmount, maximum: maximumPaymentAmount })
  }
  return amount as Yen
}
