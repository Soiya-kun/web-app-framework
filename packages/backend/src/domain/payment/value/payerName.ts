import type { Brand } from '../../shared/brand'
import { rejectValue } from '../../shared/validation'

/** 振込依頼人名（銀行の明細に出る名前）。半角・全角の違いをそろえて持つ。 */
export type PayerName = Brand<string, 'PayerName'>

export const maximumPayerNameLength = 100

export function normalizePayerName(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/g, ' ')
}

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
