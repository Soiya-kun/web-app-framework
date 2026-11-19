import type { Brand } from '../../shared/brand'
import { rejectValue } from '../../shared/validation'

/** 振込依頼人名（銀行の明細に出る名前）。半角・全角の違いをそろえて持つ。 */
export type PayerName = Brand<string, 'PayerName'>

export const maximumPayerNameLength = 100

/**
 * 銀行の明細の書き方の違い（半角カナ・全角英数・空白の数）をそろえるため。
 * 同じ振込人が同じ名前に見えるようにし、振込依頼人名から顧客を特定できるようにする。
 */
export function normalizePayerName(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/g, ' ')
}

/** 画面から入力された振込依頼人名を受け付けるため。 */
export function interpretPayerName(text: string): PayerName {
  const normalizedText = normalizePayerName(text)
  if (normalizedText === '') {
    throw rejectValue('inputRequired')
  }
  if ([...normalizedText].length > maximumPayerNameLength) {
    throw rejectValue('longText', { maximum: maximumPayerNameLength })
  }
  return normalizedText as PayerName
}
