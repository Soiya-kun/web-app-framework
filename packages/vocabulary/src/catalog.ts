// マスタ（概念・文法・文の型）から、言語ごとの文言の表（i18n 向けの変換の結果）を作る。
import { readName } from './analyze'
import { renderEnglishAction, renderEnglishLabel } from './english'
import { renderJapaneseAction, renderJapaneseLabel } from './japanese'
import type { Lexicon } from './lexicon'
import { composeMessage } from './sentence'
import { splitWords } from './split'
import type { Locale, MessageDefinition } from './types'

/** 1つの言語の文言の表。label は見出し、action はボタン、message は文。 */
export type Catalog = {
  readonly label: Readonly<Record<string, string>>
  readonly action: Readonly<Record<string, string>>
  readonly message: Readonly<Record<string, string>>
}

export const locales: readonly Locale[] = ['ja', 'en']

/** 単数・複数を原形にそろえた名前（customers と customer を同じ意味とみなす）。 */
function canonicalName(lexicon: Lexicon, key: string): string {
  return splitWords(key)
    .map((token) => {
      for (const surface of lexicon.surfaces.values()) {
        if (surface.concept.tokens.length === 1 && (surface.concept.en.plural === token || surface.concept.en.third === token)) {
          return surface.concept.id
        }
      }
      return token
    })
    .join(' ')
}

export function buildCatalogs(
  lexicon: Lexicon,
  labelKeys: readonly string[],
  actionKeys: readonly string[],
  messages: readonly MessageDefinition[],
): { readonly catalogs: Readonly<Record<Locale, Catalog>>; readonly problems: string[] } {
  const problems: string[] = []
  const labels: Record<Locale, Record<string, string>> = { ja: {}, en: {} }
  const actions: Record<Locale, Record<string, string>> = { ja: {}, en: {} }
  const texts: Record<Locale, Record<string, string>> = { ja: {}, en: {} }

  for (const key of labelKeys) {
    const { reading, unknown } = readName(lexicon, key, 'noun')
    if (reading === null || reading.kind !== 'nounPhrase') {
      problems.push(`見出し「${key}」に単語帳にない単語がある（${unknown.join('・')}）`)
      continue
    }
    labels.ja[key] = renderJapaneseLabel(reading.phrase)
    labels.en[key] = renderEnglishLabel(reading.phrase)
  }

  for (const key of actionKeys) {
    const { reading } = readName(lexicon, key, 'verb')
    const isSingleVerb =
      reading?.kind === 'verbPhrase' && reading.phrase.object.units.length === 0 && reading.phrase.object.modifiers.length === 0
    if (reading?.kind !== 'verbPhrase' || !isSingleVerb) {
      problems.push(`ボタン「${key}」は動詞1語にする`)
      continue
    }
    actions.ja[key] = renderJapaneseAction(reading.phrase.verb)
    actions.en[key] = renderEnglishAction(reading.phrase.verb)
  }

  for (const message of messages) {
    for (const locale of locales) {
      try {
        texts[locale][message.key] = composeMessage(lexicon, message, locale)
      } catch (error) {
        problems.push(`文「${message.key}」: ${(error as Error).message}`)
      }
    }
  }

  // 意味の違う見出しが、同じ文言にならないこと（文言から意味へ1通りに戻せること）を確かめる。
  for (const locale of locales) {
    const owners = new Map<string, string>()
    for (const [key, text] of Object.entries(labels[locale])) {
      const canonical = canonicalName(lexicon, key)
      const owner = owners.get(text)
      if (owner !== undefined && owner !== canonical) {
        problems.push(`${locale} の見出し「${text}」が「${owner}」と「${canonical}」の両方になる`)
      }
      owners.set(text, canonical)
    }
  }

  const catalogs = Object.fromEntries(
    locales.map((locale) => [locale, { label: labels[locale], action: actions[locale], message: texts[locale] }]),
  ) as Record<Locale, Catalog>
  return { catalogs, problems }
}
