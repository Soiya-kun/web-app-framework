import type { Brand } from '../../shared/brand'
import type { IdGenerator } from '../../shared/idGenerator'
import { rejectValue } from '../../shared/validation'

/** 入金を1件に決める ID。 */
export type PaymentId = Brand<string, 'PaymentId'>

/** 新しい入金に ID を割り当てるため。 */
export function assignPaymentId(idGenerator: IdGenerator): PaymentId {
  return idGenerator.generate() as PaymentId
}

/** 画面から届いた入金の ID を受け付けるため。 */
export function interpretPaymentId(text: string): PaymentId {
  if (text === '') {
    throw rejectValue('inputRequired')
  }
  return text as PaymentId
}
