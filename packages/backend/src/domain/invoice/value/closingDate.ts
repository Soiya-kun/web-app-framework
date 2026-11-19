import type { Brand } from '../../shared/brand'
import { interpretDateText } from '../../shared/dateValue'

/** 請求締め日。この日までの、まだ請求に載せていない売上・入金・返金・調整を請求に載せる。 */
export type ClosingDate = Brand<string, 'ClosingDate'>

export function interpretClosingDate(text: string): ClosingDate {
  return interpretDateText(text) as ClosingDate
}
