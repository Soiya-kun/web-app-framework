import type { Brand } from '../../shared/brand'
import { interpretDateText } from '../../shared/dateValue'

/** 入金のあった日（YYYY-MM-DD）。 */
export type PaymentDate = Brand<string, 'PaymentDate'>

/** 画面から入力された日付を、入金日として受け付けるため。 */
export function interpretPaymentDate(text: string): PaymentDate {
  return interpretDateText(text) as PaymentDate
}
