// 英語の名前を読み、意味の木（動詞句・名詞句）にする。語彙と文法を絞った「制御された英語」として読む。
import type { Lexicon, Surface } from './lexicon'
import { splitWords } from './split'
import type { Concept } from './types'

export type Lexeme = { readonly kind: 'known'; readonly surface: Surface; readonly text: string } | { readonly kind: 'unknown'; readonly text: string }

/** 名詞を修飾する語。形容詞か、動詞から作った形（発行済み・未発行・締められる）。 */
export type Modifier = {
  readonly concept: Concept
  readonly derivation: 'adjective' | 'perfective' | 'negativePerfective' | 'potential'
}

/** 名詞句の中の名詞。動詞の名詞形（登録・締め）も名詞として並ぶ。 */
export type NounUnit = {
  readonly concept: Concept
  readonly nominalized: boolean
  readonly plural: boolean
}

export type Relation = {
  readonly preposition: Concept
  readonly object: NounPhrase
}

/** 名詞句。predicate は名詞の後ろに来た修飾語（closingCancelable の cancelable）で、「締めを取り消せる」のような節になる。 */
export type NounPhrase = {
  readonly modifiers: readonly Modifier[]
  readonly units: readonly NounUnit[]
  readonly predicate: Modifier | null
  readonly relations: readonly Relation[]
}

export type VerbPhrase = {
  readonly verb: Concept
  readonly object: NounPhrase
}

export type Reading = { readonly kind: 'verbPhrase'; readonly phrase: VerbPhrase } | { readonly kind: 'nounPhrase'; readonly phrase: NounPhrase }

/** 単語の並びを、最長一致で語（複合語を含む）に分ける。単語帳にない単語は unknown にする。 */
export function readLexemes(lexicon: Lexicon, tokens: readonly string[]): Lexeme[] {
  const lexemes: Lexeme[] = []
  let index = 0
  while (index < tokens.length) {
    let found: Lexeme | undefined
    for (let length = Math.min(lexicon.longestSurface, tokens.length - index); length >= 1; length -= 1) {
      const text = tokens.slice(index, index + length).join(' ')
      const surface = lexicon.surfaces.get(text)
      if (surface !== undefined) {
        found = { kind: 'known', surface, text }
        index += length
        break
      }
    }
    if (found === undefined) {
      found = { kind: 'unknown', text: tokens[index] ?? '' }
      index += 1
    }
    lexemes.push(found)
  }
  return lexemes
}

type Part =
  | { readonly kind: 'unit'; readonly unit: NounUnit }
  | { readonly kind: 'modifier'; readonly modifier: Modifier }
  | { readonly kind: 'preposition'; readonly concept: Concept }

function classify(surface: Surface): Part {
  const { concept, form } = surface
  switch (concept.category) {
    case 'noun':
      return { kind: 'unit', unit: { concept, nominalized: false, plural: form === 'plural' } }
    case 'adjective':
      return { kind: 'modifier', modifier: { concept, derivation: 'adjective' } }
    case 'preposition':
      return { kind: 'preposition', concept }
    case 'verb':
      if (form === 'past' || form === 'participle') {
        return { kind: 'modifier', modifier: { concept, derivation: 'perfective' } }
      }
      if (form === 'unPast') {
        return { kind: 'modifier', modifier: { concept, derivation: 'negativePerfective' } }
      }
      if (form === 'able') {
        return { kind: 'modifier', modifier: { concept, derivation: 'potential' } }
      }
      return { kind: 'unit', unit: { concept, nominalized: true, plural: form === 'third' } }
  }
}

function readSegment(parts: readonly Part[]): NounPhrase {
  const modifiers: Modifier[] = []
  const units: NounUnit[] = []
  let predicate: Modifier | null = null
  parts.forEach((part, index) => {
    if (part.kind === 'unit') {
      units.push(part.unit)
    } else if (part.kind === 'modifier') {
      // 名詞の後ろの最後の修飾語は、述語（節）として読む。それ以外は名詞の前に置く。
      if (units.length > 0 && index === parts.length - 1) {
        predicate = part.modifier
      } else if (units.length === 0 && index === parts.length - 1 && modifiers.length === 0 && parts.length === 1) {
        modifiers.push(part.modifier)
      } else {
        modifiers.push(part.modifier)
      }
    }
  })
  return { modifiers, units, predicate, relations: [] }
}

/** 前置詞で区切り、最初の区切りを中心の語、残りを関係にする。 */
function readNounPhrase(parts: readonly Part[]): NounPhrase {
  const segments: { preposition: Concept | null; parts: Part[] }[] = [{ preposition: null, parts: [] }]
  for (const part of parts) {
    if (part.kind === 'preposition') {
      segments.push({ preposition: part.concept, parts: [] })
    } else {
      segments.at(-1)?.parts.push(part)
    }
  }
  const [head, ...rest] = segments
  const phrase = readSegment(head?.parts ?? [])
  return {
    ...phrase,
    relations: rest.flatMap((segment) =>
      segment.preposition === null ? [] : [{ preposition: segment.preposition, object: readSegment(segment.parts) }],
    ),
  }
}

/**
 * 名前を読む。mode が verb なら、原形の動詞で始まる名前を動詞句（createSales）として読む。
 * noun なら、すべて名詞句（見出し・型・変数）として読み、動詞は名詞形（salesCreate →「売上登録」）にする。
 * 単語帳にない単語があれば reading は null で、unknown にその単語を返す。
 */
export function readName(lexicon: Lexicon, name: string, mode: 'verb' | 'noun'): { readonly reading: Reading | null; readonly unknown: readonly string[] } {
  const lexemes = readLexemes(lexicon, splitWords(name))
  const unknown = lexemes.flatMap((lexeme) => (lexeme.kind === 'unknown' ? [lexeme.text] : []))
  if (unknown.length > 0) {
    return { reading: null, unknown }
  }
  const surfaces = lexemes.flatMap((lexeme) => (lexeme.kind === 'known' ? [lexeme.surface] : []))
  const [first, ...rest] = surfaces
  if (mode === 'verb' && first !== undefined && first.concept.category === 'verb' && (first.form === 'base' || first.form === 'third')) {
    return { reading: { kind: 'verbPhrase', phrase: { verb: first.concept, object: readNounPhrase(rest.map(classify)) } }, unknown }
  }
  return { reading: { kind: 'nounPhrase', phrase: readNounPhrase(surfaces.map(classify)) }, unknown }
}

/** 名前の中の、単語帳にない単語。 */
export function findUnknownWords(lexicon: Lexicon, name: string): string[] {
  return readLexemes(lexicon, splitWords(name)).flatMap((lexeme) => (lexeme.kind === 'unknown' ? [lexeme.text] : []))
}
