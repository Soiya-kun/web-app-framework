import type { Brand } from '../../shared/brand'
import { rejectValue } from '../../shared/validation'

/** 顧客を1件に決める ID。 */
export type CustomerId = Brand<string, 'CustomerId'>

export function interpretCustomerId(text: string): CustomerId {
  if (text === '') {
    throw rejectValue('selectionRequired')
  }
  return text as CustomerId
}
