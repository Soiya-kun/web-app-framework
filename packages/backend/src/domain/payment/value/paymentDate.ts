import type { Brand } from '../../shared/brand'
import { interpretDateText } from '../../shared/dateValue'

/** 入金のあった日（YYYY-MM-DD）。 */
export type PaymentDate = Brand<string, 'PaymentDate'>

export function interpretPaymentDate(text: string): PaymentDate {
  return interpretDateText(text) as PaymentDate
}
