import type { Locale } from '@app/vocabulary/text'

const yenFormats = {
  ja: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }),
  en: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'JPY' }),
} as const satisfies Record<Locale, Intl.NumberFormat>

/** 円の金額を、画面の言語の書き方で出す。 */
export function displayYen(locale: Locale, amount: number): string {
  return yenFormats[locale].format(amount)
}
