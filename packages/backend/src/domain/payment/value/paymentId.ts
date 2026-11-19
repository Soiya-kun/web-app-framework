import type { Brand } from '../../shared/brand'
import type { IdGenerator } from '../../shared/idGenerator'
import { rejectValue } from '../../shared/validation'

/** 入金を1件に決める ID。 */
export type PaymentId = Brand<string, 'PaymentId'>

export function assignPaymentId(idGenerator: IdGenerator): PaymentId {
  return idGenerator.generate() as PaymentId
}

export function interpretPaymentId(text: string): PaymentId {
  if (text === '') {
    throw rejectValue('inputRequired')
  }
  return text as PaymentId
}
