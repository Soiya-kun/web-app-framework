import { rejectValue } from '../../shared/validation'

/** 売上区分。返品・値引は負の金額で持つ。 */
export const salesKinds = ['normal', 'return', 'discount'] as const

export type SalesKind = (typeof salesKinds)[number]

/** 画面で選んだ区分を、売上区分として受け付けるため。 */
export function interpretSalesKind(text: string): SalesKind {
  const salesKind = salesKinds.find((kind) => kind === text)
  if (salesKind === undefined) {
    throw rejectValue('selectionRequired')
  }
  return salesKind
}
