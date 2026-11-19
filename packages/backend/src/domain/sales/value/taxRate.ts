import { rejectValue } from '../../shared/validation'

/** 消費税率（%）。10 は標準税率、8 は軽減税率。 */
export const taxRates = [10, 8] as const

export type TaxRate = (typeof taxRates)[number]

export function interpretTaxRate(text: string): TaxRate {
  const taxRate = taxRates.find((rate) => String(rate) === text)
  if (taxRate === undefined) {
    throw rejectValue('selectionRequired')
  }
  return taxRate
}
