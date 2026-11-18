/** 品詞。翻訳ツールが語順を並べ替えるときに使う。 */
export type PartOfSpeech = 'verb' | 'noun' | 'adjective' | 'preposition'

/** システム向けの単語か、業務（ドメイン）の単語か。 */
export type WordKind = 'system' | 'domain'

export type Locale = 'ja' | 'en'

export type WordEntry = {
  /** 識別子に使う英単語の原形（小文字）。 */
  readonly word: string
  readonly kind: WordKind
  readonly pos: PartOfSpeech
  /** 複数形など、原形以外に識別子で使ってよい形。 */
  readonly forms: readonly string[]
  /** 日本語。動詞は体言止めの形（登録）、前置詞は名詞句の型（{object}用の{head}）。 */
  readonly ja: string
  /** 動詞の「〜する」の形（登録する）。前置詞は手順の型（{object}で{head}を{verb}）。 */
  readonly jaVerb: string
  /** 前置詞だけが持つ、関数名（体言止め）の型（{object}での{head}の{verb}）。 */
  readonly jaName: string
  /** 画面に出す英語。 */
  readonly en: string
  /** repository・generator など、受け手の役割を表す名詞。翻訳では目的語から外す。 */
  readonly role: boolean
  /** 同じ意味で使わせない単語。 */
  readonly avoid: readonly string[]
  readonly description: string
}

/** 単語の組合せでは訳が決まらない並び（例: created at →「登録日時」）。 */
export type PhraseEntry = {
  readonly words: readonly string[]
  readonly ja: string
  readonly en: string
}

/** 画面に出す文。キーも単語帳の単語だけで作る。 */
export type MessageEntry = {
  readonly key: string
  readonly ja: string
  readonly en: string
}
