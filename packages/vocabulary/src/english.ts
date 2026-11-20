// 意味の木を英語にする。見出し（Title Case の名詞句）・ボタン（命令形）・処理の手順。
import type { Modifier, NounPhrase, NounUnit, VerbPhrase } from './analyze'
import { capitalize, titleCase } from './morphology'
import type { Concept } from './types'

function modifierText(modifier: Modifier): string {
  const en = modifier.concept.en
  switch (modifier.derivation) {
    case 'adjective':
      return en.base
    case 'perfective':
      return en.participle ?? en.base
    case 'negativePerfective':
      return en.unPast ?? en.base
    case 'potential':
      return en.able ?? en.base
  }
}

function unitText(unit: NounUnit): string {
  const en = unit.concept.en
  if (unit.nominalized) {
    return titleCase(en.noun ?? en.base)
  }
  const isOverridden = en.label !== titleCase(en.base)
  if (unit.plural) {
    return isOverridden ? `${en.label}s` : titleCase(en.plural ?? en.base)
  }
  return en.label
}

/** 名詞句を見出しにする（salesAmount → "Sales Amount"、salesCreate → "Sales Creation"）。 */
export function renderEnglishLabel(phrase: NounPhrase): string {
  const words = [
    ...phrase.modifiers.map((modifier) => titleCase(modifierText(modifier))),
    ...phrase.units.map(unitText),
    ...(phrase.predicate === null ? [] : [titleCase(modifierText(phrase.predicate))]),
  ]
  const core = words.join(' ')
  return phrase.relations.reduce((text, relation) => `${text} ${relation.preposition.en.base} ${renderEnglishLabel(relation.object)}`, core)
}

/** 文の途中に置く形（頭を小文字にする。ID などの上書きはそのまま）。 */
export function renderEnglishPhraseInSentence(phrase: NounPhrase): string {
  const label = renderEnglishLabel(phrase)
  return label
    .split(' ')
    .map((word) => (/^[A-Z][a-z]/.test(word) ? word.toLowerCase() : word))
    .join(' ')
}

/** ボタンの文言（動詞の命令形。issue → "Issue"）。 */
export function renderEnglishAction(verb: Concept): string {
  return capitalize(verb.en.base)
}

/** 関数名の見出し（命令形の Title Case。registerPayment → "Register Payment"）。 */
export function renderEnglishTitle(phrase: VerbPhrase): string {
  const object = renderEnglishLabel(phrase.object)
  return object === '' ? capitalize(phrase.verb.en.base) : `${capitalize(phrase.verb.en.base)} ${object}`
}

/** 処理の手順（命令形。createSales → "Create sales"）。 */
export function renderEnglishStep(phrase: VerbPhrase): string {
  const object = renderEnglishPhraseInSentence(phrase.object)
  return object === '' ? capitalize(phrase.verb.en.base) : `${capitalize(phrase.verb.en.base)} ${object}`
}
