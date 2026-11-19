// 画面が使う文言。マスタから生成した文言の表（i18n 向けの変換の結果）だけを読み、文法の処理は持たない。
import type { ActionKey, LabelKey, MessageKey } from './generated/catalogKey'
import en from './generated/locale/en.json'
import ja from './generated/locale/ja.json'

export type { ActionKey, LabelKey, MessageKey } from './generated/catalogKey'

export type Locale = 'ja' | 'en'

export type MessageParams = Readonly<Record<string, string | number>>

export type Text = {
  readonly locale: Locale
  /** 見出し（名詞句。salesAmount →「売上金額」/ "Sales Amount"）。 */
  label(key: LabelKey): string
  /** ボタン（動詞。issue →「発行」/ "Issue"）。 */
  action(key: ActionKey): string
  /** 文。{field} などに値を埋める。 */
  message(key: MessageKey, params?: MessageParams): string
}

type CatalogTable = {
  readonly label: Readonly<Record<string, string>>
  readonly action: Readonly<Record<string, string>>
  readonly message: Readonly<Record<string, string>>
}

const catalogs: Readonly<Record<Locale, CatalogTable>> = { ja, en }

/** 見出しのキーを、表に載せるために書く（変数に入れる見出しのキーは、これで包むと抽出される）。 */
export function labelKey<Key extends LabelKey>(key: Key): Key {
  return key
}

/** ボタンのキーを、表に載せるために書く。 */
export function actionKey<Key extends ActionKey>(key: Key): Key {
  return key
}

export function prepareText(locale: Locale): Text {
  const catalog = catalogs[locale]
  return {
    locale,
    label(key) {
      return catalog.label[key] ?? key
    },
    action(key) {
      return catalog.action[key] ?? key
    },
    message(key, params = {}) {
      const template = catalog.message[key] ?? key
      return template.replace(/\{(\w+)\}/g, (whole, name: string) => String(params[name] ?? whole))
    },
  }
}

/** ボタンのキーか（ボタンの表にあるか）。見出しのキーと見分ける。 */
export function isActionKey(key: string): key is ActionKey {
  return Object.hasOwn(ja.action, key)
}
