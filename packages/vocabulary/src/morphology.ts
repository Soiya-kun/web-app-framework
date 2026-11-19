// 語形を作る。英語は原形から規則で作り、不規則な形だけを単語帳に書く。日本語は活用の型から作る。
import type { JapaneseAdjectiveClass, JapaneseVerbClass } from './types'

const vowels = new Set(['a', 'e', 'i', 'o', 'u'])

function endsWithConsonantY(word: string): boolean {
  return word.endsWith('y') && word.length > 1 && !vowels.has(word.at(-2) ?? '')
}

/** 複数形・三単現（invoice → invoices、entry → entries、tax → taxes）。 */
export function pluralizeEnglish(word: string): string {
  if (/(s|x|z|ch|sh)$/.test(word)) {
    return `${word}es`
  }
  if (endsWithConsonantY(word)) {
    return `${word.slice(0, -1)}ies`
  }
  return `${word}s`
}

/** 規則変化の過去形（create → created、apply → applied、issue → issued）。 */
export function makeEnglishPast(word: string): string {
  if (word.endsWith('e')) {
    return `${word}d`
  }
  if (endsWithConsonantY(word)) {
    return `${word.slice(0, -1)}ied`
  }
  return `${word}ed`
}

/** -ing 形（close → closing、load → loading）。 */
export function makeEnglishGerund(word: string): string {
  if (word.endsWith('ie')) {
    return `${word.slice(0, -2)}ying`
  }
  if (word.endsWith('e') && !word.endsWith('ee')) {
    return `${word.slice(0, -1)}ing`
  }
  return `${word}ing`
}

/** -able 形（close → closable、identify → identifiable、cancel → cancelable）。 */
export function makeEnglishAble(word: string): string {
  if (word.endsWith('e')) {
    return `${word.slice(0, -1)}able`
  }
  if (endsWithConsonantY(word)) {
    return `${word.slice(0, -1)}iable`
  }
  return `${word}able`
}

export function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** 見出しの形（各単語の頭を大文字にする）。 */
export function titleCase(text: string): string {
  return text.split(' ').map(capitalize).join(' ')
}

/** 五段活用の語尾の行（辞書形の最後の文字 → 各形の語尾）。 */
const godanEndings: Readonly<Record<string, { readonly a: string; readonly i: string; readonly e: string; readonly te: string; readonly ta: string }>> = {
  う: { a: 'わ', i: 'い', e: 'え', te: 'って', ta: 'った' },
  く: { a: 'か', i: 'き', e: 'け', te: 'いて', ta: 'いた' },
  ぐ: { a: 'が', i: 'ぎ', e: 'げ', te: 'いで', ta: 'いだ' },
  す: { a: 'さ', i: 'し', e: 'せ', te: 'して', ta: 'した' },
  つ: { a: 'た', i: 'ち', e: 'て', te: 'って', ta: 'った' },
  ぬ: { a: 'な', i: 'に', e: 'ね', te: 'んで', ta: 'んだ' },
  ぶ: { a: 'ば', i: 'び', e: 'べ', te: 'んで', ta: 'んだ' },
  む: { a: 'ま', i: 'み', e: 'め', te: 'んで', ta: 'んだ' },
  る: { a: 'ら', i: 'り', e: 'れ', te: 'って', ta: 'った' },
}

export type JapaneseVerbForms = {
  readonly noun: string
  readonly dictionary: string
  readonly te: string
  readonly past: string
  readonly potential: string
  readonly politePast: string
  readonly negative: string
  readonly perfective: string
  readonly perfectiveLabel: string
  readonly negativePerfective: string
  readonly negativePerfectiveLabel: string
}

/**
 * 日本語の動詞の活用を作る。
 * サ変は語幹（発行）から、一段・五段は辞書形（締める・取り消す）から作る。名詞形は書いてあればそれを使う。
 * 完了・未完了の連体形は、サ変なら「発行済みの」「未発行の」、それ以外なら「請求に載せた」「請求に載せていない」にする。
 */
export function conjugateJapanese(verbClass: JapaneseVerbClass, stemOrDictionary: string, noun: string | null): JapaneseVerbForms {
  if (verbClass === 'suru') {
    const stem = stemOrDictionary
    return {
      noun: noun ?? stem,
      dictionary: `${stem}する`,
      te: `${stem}して`,
      past: `${stem}した`,
      potential: `${stem}できる`,
      politePast: `${stem}しました`,
      negative: `${stem}しない`,
      perfective: `${stem}済みの`,
      perfectiveLabel: `${stem}済み`,
      negativePerfective: `未${stem}の`,
      negativePerfectiveLabel: `未${stem}`,
    }
  }
  const dictionary = stemOrDictionary
  const base = dictionary.slice(0, -1)
  if (verbClass === 'ichidan') {
    return {
      noun: noun ?? base,
      dictionary,
      te: `${base}て`,
      past: `${base}た`,
      potential: `${base}られる`,
      politePast: `${base}ました`,
      negative: `${base}ない`,
      perfective: `${base}た`,
      perfectiveLabel: `${base}た`,
      negativePerfective: `${base}ていない`,
      negativePerfectiveLabel: `${base}ていない`,
    }
  }
  const ending = godanEndings[dictionary.slice(-1)]
  if (ending === undefined) {
    throw new Error(`五段活用の語尾ではありません: ${dictionary}`)
  }
  const te = `${base}${ending.te}`
  return {
    noun: noun ?? `${base}${ending.i}`,
    dictionary,
    te,
    past: `${base}${ending.ta}`,
    potential: `${base}${ending.e}る`,
    politePast: `${base}${ending.i}ました`,
    negative: `${base}${ending.a}ない`,
    perfective: `${base}${ending.ta}`,
    perfectiveLabel: `${base}${ending.ta}`,
    negativePerfective: `${te}いない`,
    negativePerfectiveLabel: `${te}いない`,
  }
}

export type JapaneseAdjectiveForms = {
  readonly attributive: string
  readonly predicative: string
  readonly label: string
}

/** 日本語の形容詞の形を作る（連体形・述語の形・単独の形）。 */
export function inflectJapaneseAdjective(
  adjectiveClass: JapaneseAdjectiveClass,
  stem: string,
  predicative: string | null,
): JapaneseAdjectiveForms {
  switch (adjectiveClass) {
    case 'no':
      return { attributive: `${stem}の`, predicative: predicative ?? `${stem}である`, label: stem }
    case 'na':
      return { attributive: `${stem}な`, predicative: predicative ?? `${stem}である`, label: stem }
    case 'i':
      return { attributive: stem, predicative: predicative ?? stem, label: stem }
    case 'prefix':
      return { attributive: stem, predicative: predicative ?? `${stem}である`, label: stem }
  }
}
