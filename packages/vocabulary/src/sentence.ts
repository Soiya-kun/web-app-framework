// 画面の文を、文の型（依頼・完了の報告など）と単語帳から作る。型に収まらない文は、両方の言語で書いた自由文をそのまま使う。
import { readName } from './analyze'
import { renderEnglishPhraseInSentence } from './english'
import { renderJapaneseLabel } from './japanese'
import type { Lexicon } from './lexicon'
import { capitalize } from './morphology'
import type { Concept, Locale, MessageDefinition } from './types'

function renderObject(lexicon: Lexicon, object: string | null, locale: Locale): string {
  if (object === null) {
    return ''
  }
  if (object.startsWith('$')) {
    return `{${object.slice(1)}}`
  }
  const { reading } = readName(lexicon, object, 'noun')
  if (reading === null || reading.kind !== 'nounPhrase') {
    throw new Error(`文の対象「${object}」を名詞句として読めません`)
  }
  return locale === 'ja' ? renderJapaneseLabel(reading.phrase) : renderEnglishPhraseInSentence(reading.phrase)
}

function renderJapanese(definition: MessageDefinition, verb: Concept | undefined, object: string): string {
  const ja = verb?.ja
  switch (definition.frame) {
    case 'request':
      return `${object}を${ja?.te ?? ''}ください。`
    case 'prompt':
      return `${ja?.te ?? ''}ください`
    case 'done':
      return object === '' ? `${ja?.politePast ?? ''}。` : `${object}を${ja?.politePast ?? ''}。`
    case 'progress':
      return `${ja?.te ?? ''}います…`
    case 'missing':
      return `${object}が見つかりません。`
    case null:
      return ''
  }
}

function renderEnglish(definition: MessageDefinition, verb: Concept | undefined, object: string): string {
  const en = verb?.en
  switch (definition.frame) {
    case 'request':
      return `${capitalize(en?.base ?? '')} ${object}.`
    case 'prompt':
      return `${capitalize(en?.base ?? '')}…`
    case 'done':
      return object === '' ? `${capitalize(en?.participle ?? '')}.` : `${capitalize(object)} ${en?.participle ?? ''}.`
    case 'progress':
      return `${capitalize(en?.gerund ?? '')}…`
    case 'missing':
      return `The ${object} was not found.`
    case null:
      return ''
  }
}

/** 画面の文を1つの言語で作る。値の場所は {field} のように残す。 */
export function composeMessage(lexicon: Lexicon, definition: MessageDefinition, locale: Locale): string {
  if (definition.free !== null) {
    return definition.free[locale]
  }
  const verb = definition.verb === null ? undefined : lexicon.concepts.get(definition.verb)
  const object = renderObject(lexicon, definition.object, locale)
  return locale === 'ja' ? renderJapanese(definition, verb, object) : renderEnglish(definition, verb, object)
}
