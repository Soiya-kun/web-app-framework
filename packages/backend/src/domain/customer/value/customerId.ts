import type { Brand } from '../../shared/brand'
import { rejectValue } from '../../shared/validation'

/** 顧客を1件に決める ID。 */
export type CustomerId = Brand<string, 'CustomerId'>

/** 画面で選んだ顧客を、顧客 ID として受け付けるため。 */
export function interpretCustomerId(text: string): CustomerId {
  if (text === '') {
    throw rejectValue('selectionRequired')
  }
  return text as CustomerId
}
