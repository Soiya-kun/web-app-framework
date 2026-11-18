import type { Brand } from '../../shared/brand'
import { rejectValue } from '../../shared/validation'

/** 請求書に出す売上の品名・摘要。 */
export type ItemName = Brand<string, 'ItemName'>

export const maximumItemNameLength = 100

/** 画面から入力された品名を受け付けるため。 */
export function interpretItemName(text: string): ItemName {
  const trimmedText = text.trim()
  if (trimmedText === '') {
    throw rejectValue('inputRequired')
  }
  if ([...trimmedText].length > maximumItemNameLength) {
    throw rejectValue('longText', { maximum: maximumItemNameLength })
  }
  return trimmedText as ItemName
}
