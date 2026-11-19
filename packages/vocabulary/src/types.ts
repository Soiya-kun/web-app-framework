/** 単語帳の概念の品詞。複合語（billing customer など）は名詞として持つ。 */
export type Category = 'noun' | 'verb' | 'adjective' | 'preposition'

/** システム向けの単語か、業務（ドメイン）の単語か。 */
export type WordKind = 'system' | 'domain'

export type Locale = 'ja' | 'en'

/** 日本語の動詞の活用の型。suru は「発行する」のようなサ変、ichidan は「締める」、godan は「取り消す」。 */
export type JapaneseVerbClass = 'suru' | 'ichidan' | 'godan'

/** 日本語の形容詞の型。no は「発行前の」、na は「有効な」、i は「見つからない」、prefix は「今回」のように「の」なしで前に付く。 */
export type JapaneseAdjectiveClass = 'no' | 'na' | 'i' | 'prefix'

/** 英語の語形。名前の中では、ここにある形だけを使える。 */
export type EnglishForms = {
  /** 原形（複合語は単語を空白でつないだもの）。 */
  readonly base: string
  /** 見出しの形（Title Case。ID・API などは上書き）。 */
  readonly label: string
  readonly plural: string | null
  readonly third: string | null
  readonly past: string | null
  readonly participle: string | null
  readonly gerund: string | null
  readonly able: string | null
  readonly unPast: string | null
  /** 動詞の名詞形（creation・issuance）。 */
  readonly noun: string | null
}

/** 日本語の語形。品詞ごとに使う欄が決まる（使わない欄は null）。 */
export type JapaneseForms = {
  /** 名詞の形（名詞・複合語）。 */
  readonly form: string | null
  /** 前の名詞への、つなぎ方（direct は「の」なし）。名詞・複合語と、動詞の名詞形。 */
  readonly attach: 'direct' | 'no' | null
  readonly verbClass: JapaneseVerbClass | null
  /** 動詞の名詞形（発行・締め）。 */
  readonly noun: string | null
  /** 単独で見出し・ボタンにするときの形（動詞は名詞形か上書き、形容詞は語幹）。 */
  readonly label: string | null
  readonly dictionary: string | null
  readonly te: string | null
  readonly past: string | null
  readonly potential: string | null
  readonly politePast: string | null
  readonly negative: string | null
  /** 完了の連体形（発行済みの・請求に載せた）と、その単独の形。 */
  readonly perfective: string | null
  readonly perfectiveLabel: string | null
  /** 未完了の連体形（未発行の・請求に載せていない）と、その単独の形。 */
  readonly negativePerfective: string | null
  readonly negativePerfectiveLabel: string | null
  readonly adjectiveClass: JapaneseAdjectiveClass | null
  readonly attributive: string | null
  readonly predicative: string | null
  /** 前置詞の型。 */
  readonly nounPattern: string | null
  readonly stepPattern: string | null
  readonly titlePattern: string | null
}

/** 単語帳の概念。ID は英語の原形（複合語は camelCase）。1つの概念は1つの意味だけを持つ。 */
export type Concept = {
  readonly id: string
  readonly kind: WordKind
  readonly category: Category
  /** 名前の中での英単語の並び（複合語は2語以上）。 */
  readonly tokens: readonly string[]
  readonly en: EnglishForms
  readonly ja: JapaneseForms
  readonly role: boolean
  readonly avoid: readonly string[]
  readonly description: string
}

/** 英語の語形の名前。名前の中の単語が、概念のどの形かを表す。 */
export type EnglishFormName = 'base' | 'plural' | 'third' | 'noun' | 'past' | 'participle' | 'gerund' | 'able' | 'unPast'

/** 画面の文の型。 */
export type MessageFrame = 'request' | 'prompt' | 'done' | 'progress' | 'missing'

/** 画面の文の定義。frame の文は単語帳と文法から作り、free の文は両方の言語で書く。 */
export type MessageDefinition = {
  readonly key: string
  readonly frame: MessageFrame | null
  readonly verb: string | null
  /** $field のような値の名前か、単語帳の名詞の id。 */
  readonly object: string | null
  readonly free: Readonly<Record<Locale, string>> | null
}
