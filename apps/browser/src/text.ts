// ブラウザの文言と言語。アプリと同じ単語帳から生成した文言の表を引く。言語（日本語・英語）は画面の上で切り替え、ブラウザに覚える。
import type { Locale } from '@app/vocabulary'
import { prepareText, type Text } from '@app/vocabulary/text'
import { createContext, use } from 'react'

/** 見出しどうしのつなぎ方（語順・かっこ・区切り）。 */
export type LabelFormat = {
  /** 月次の請求のレーン図 / Lane Diagram of Monthly Invoice */
  readonly joinItem: (parent: string, item: string) => string
  /** 要約（業務フロー） / Summary (Flow) */
  readonly joinNote: (primary: string, note: string) => string
  /** 見出しの後ろに添える補足（「（未着手 4）」/ " (Pending 4)"）。 */
  readonly formatNote: (note: string) => string
  /** 要約・段 10 / Summary · Step 10 */
  readonly mark: string
  /** 本線・5a / main, 5a */
  readonly joinList: (items: readonly string[]) => string
  /** 入力の並び（請求先「株式会社親」、請求締め日「…」）。 */
  readonly joinSequence: (items: readonly string[]) => string
  /** 業務フローの中の段の番号（「の 8.2」/ ", step 8.2"）。 */
  readonly formatStepNumber: (number: string) => string
}

const labelFormats: Readonly<Record<Locale, LabelFormat>> = {
  ja: {
    joinItem: (parent, item) => `${parent}の${item}`,
    joinNote: (primary, note) => `${primary}（${note}）`,
    formatNote: (note) => `（${note}）`,
    mark: '・',
    joinList: (items) => items.join('・'),
    joinSequence: (items) => items.join('、'),
    formatStepNumber: (number) => `の ${number}`,
  },
  en: {
    joinItem: (parent, item) => `${item} of ${parent}`,
    joinNote: (primary, note) => `${primary} (${note})`,
    formatNote: (note) => ` (${note})`,
    mark: ' · ',
    joinList: (items) => items.join(', '),
    joinSequence: (items) => items.join(', '),
    formatStepNumber: (number) => `, step ${number}`,
  },
}

export type LocaleState = {
  readonly locale: Locale
  readonly text: Text
  readonly labelFormat: LabelFormat
  readonly selectLocale: (locale: Locale) => void
}

const texts: Readonly<Record<Locale, Text>> = { ja: prepareText('ja'), en: prepareText('en') }

export const LocaleContext = createContext<LocaleState>({ locale: 'ja', text: texts.ja, labelFormat: labelFormats.ja, selectLocale: () => undefined })

export function prepareLocaleState(locale: Locale, selectLocale: (locale: Locale) => void): LocaleState {
  return { locale, text: texts[locale], labelFormat: labelFormats[locale], selectLocale }
}

/** 今の言語の、見出しどうしのつなぎ方。 */
export function useLabelFormat(): LabelFormat {
  return use(LocaleContext).labelFormat
}

/** 今の言語の文言の表。 */
export function useText(): Text {
  return use(LocaleContext).text
}

export function useLocale(): LocaleState {
  return use(LocaleContext)
}

const localeKey = 'code-browser:locale'

/** 覚えた言語を読む（読めなければ日本語）。 */
export function readSavedLocale(): Locale {
  try {
    return globalThis.localStorage?.getItem(localeKey) === 'en' ? 'en' : 'ja'
  } catch {
    return 'ja'
  }
}

export function saveLocale(locale: Locale): void {
  try {
    globalThis.localStorage?.setItem(localeKey, locale)
  } catch {
    // 保存できない環境（プライベートウィンドウなど）では、覚えないだけにする。
  }
}

/** 言語を切り替えるボタン。押すと、もう一方の言語にする（ボタンの文字は切り替え先の言語で書く）。 */
export function readOtherLocale(locale: Locale): { readonly locale: Locale; readonly title: string } {
  return locale === 'ja' ? { locale: 'en', title: texts.en.label('english') } : { locale: 'ja', title: texts.ja.label('japanese') }
}
