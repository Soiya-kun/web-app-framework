// 画面に出す文言を単語帳から引く。見出しは単語の並びから組み立て、文は messages.yaml から引く。
import { messageList, type MessageKey } from './generated/vocabularyData'
import { renderNounPhrase } from './grammar'
import type { Locale } from './types'

export type MessageParams = Readonly<Record<string, string | number>>

export type Text = {
  readonly locale: Locale
  /** 識別子の名前から見出しを作る（salesAmount →「売上金額」/ "Sales Amount"）。 */
  label(name: string): string
  /** messages.yaml の文に値を埋める。 */
  message(key: MessageKey, params?: MessageParams): string
}

const messageIndex = new Map<string, (typeof messageList)[number]>(messageList.map((entry) => [entry.key, entry]))

export function prepareText(locale: Locale): Text {
  return {
    locale,
    label(name) {
      return renderNounPhrase(name, locale)
    },
    message(key, params = {}) {
      const entry = messageIndex.get(key)
      const template = entry === undefined ? key : entry[locale]
      return template.replace(/\{(\w+)\}/g, (whole, name: string) => String(params[name] ?? whole))
    },
  }
}
