// 単語帳の品詞を使って、識別子を日本語（または英語）の句にする。
// 英語は「動詞 → 目的語」、日本語は「目的語 → 動詞」の順なので、品詞を見て並べ替える。
import { phraseList, wordList } from './generated/vocabularyData'
import { splitWords } from './split'
import type { Locale, PhraseEntry, WordEntry } from './types'

const wordIndex = new Map<string, WordEntry>()
for (const entry of wordList) {
  for (const form of [entry.word, ...entry.forms]) {
    wordIndex.set(form, entry)
  }
}

export function findWord(token: string): WordEntry | undefined {
  return wordIndex.get(token)
}

function baseWord(token: string): string {
  return wordIndex.get(token)?.word ?? token
}

function findPhrase(tokens: readonly string[], start: number): PhraseEntry | undefined {
  let found: PhraseEntry | undefined
  for (const phrase of phraseList) {
    const matches = phrase.words.every((word, offset) => baseWord(tokens[start + offset] ?? '') === word)
    if (matches && (found === undefined || phrase.words.length > found.words.length)) {
      found = phrase
    }
  }
  return found
}

/** 単語帳にない単語は ‹word› と印を付けて出す。 */
function joinWords(tokens: readonly string[], locale: Locale): string {
  const parts: string[] = []
  let index = 0
  while (index < tokens.length) {
    const phrase = findPhrase(tokens, index)
    if (phrase !== undefined) {
      parts.push(locale === 'ja' ? phrase.ja : phrase.en)
      index += phrase.words.length
      continue
    }
    const token = tokens[index] ?? ''
    const entry = wordIndex.get(token)
    if (entry === undefined) {
      parts.push(`‹${token}›`)
    } else {
      parts.push(locale === 'ja' ? entry.ja : entry.en)
    }
    index += 1
  }
  return parts.join(locale === 'ja' ? '' : ' ')
}

type Modifier = { readonly preposition: WordEntry; readonly object: readonly string[] }
type Structure = { readonly head: readonly string[]; readonly modifiers: readonly Modifier[] }

/** 前置詞で区切り、「中心の語」と「前置詞＋目的語」の並びにする。 */
function parseStructure(tokens: readonly string[]): Structure {
  const head: string[] = []
  const modifiers: { preposition: WordEntry; object: string[] }[] = []
  for (const token of tokens) {
    const entry = wordIndex.get(token)
    if (entry?.pos === 'preposition') {
      modifiers.push({ preposition: entry, object: [] })
    } else {
      const last = modifiers.at(-1)
      if (last === undefined) {
        head.push(token)
      } else {
        last.object.push(token)
      }
    }
  }
  return { head, modifiers }
}

function fill(pattern: string, values: Readonly<Record<string, string>>): string {
  return pattern.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)
}

function renderModifiedNoun(head: string, modifiers: readonly Modifier[]): string {
  let result = head
  for (const modifier of modifiers) {
    result = fill(modifier.preposition.ja, { head: result, object: joinWords(modifier.object, 'ja') })
  }
  return result
}

/** 名詞句にする（画面の見出し・型名・変数名の訳）。 */
export function renderNounPhrase(name: string, locale: Locale): string {
  const tokens = splitWords(name)
  if (locale === 'en') {
    return joinWords(tokens, 'en')
  }
  const structure = parseStructure(tokens)
  return renderModifiedNoun(joinWords(structure.head, 'ja'), structure.modifiers)
}

/** 受け手の名前から役割の語（repository など）を除いた目的語の単語。 */
export function objectWords(receiverName: string): string[] {
  return splitWords(receiverName).filter((token) => wordIndex.get(token)?.role !== true)
}

type VerbPhrase = { readonly verb: WordEntry; readonly structure: Structure }

function parseVerbPhrase(name: string, fallbackObject: readonly string[]): VerbPhrase | undefined {
  const [first, ...rest] = splitWords(name)
  const verb = first === undefined ? undefined : wordIndex.get(first)
  if (verb === undefined || verb.pos !== 'verb') {
    return undefined
  }
  const structure = parseStructure(rest)
  if (structure.head.length === 0 && fallbackObject.length > 0) {
    return { verb, structure: { head: fallbackObject, modifiers: structure.modifiers } }
  }
  return { verb, structure }
}

function renderVerbPhrase(phrase: VerbPhrase, form: 'name' | 'step'): string {
  const verbText = form === 'name' ? phrase.verb.ja : phrase.verb.jaVerb
  const head = joinWords(phrase.structure.head, 'ja')
  const [first, ...others] = phrase.structure.modifiers
  const pattern =
    first === undefined
      ? form === 'name'
        ? '{head}の{verb}'
        : '{head}を{verb}'
      : form === 'name'
        ? first.preposition.jaName
        : first.preposition.jaVerb
  const object = first === undefined ? '' : renderModifiedNoun(joinWords(first.object, 'ja'), others)
  const usable = head === '' ? pattern.replace(/\{head\}[をの]/, '') : pattern
  return fill(usable, { head, object, verb: verbText })
}

/** 関数名を体言止めにする（createNewTransportSales →「新輸送売上の登録」）。 */
export function translateFunctionName(name: string): string {
  const phrase = parseVerbPhrase(name, [])
  return phrase === undefined ? renderNounPhrase(name, 'ja') : renderVerbPhrase(phrase, 'name')
}

/**
 * 呼び出しを「〜する」の手順にする（validateSalesRequest →「売上リクエストをバリデーションする」）。
 * メソッド名が動詞だけのときは、受け手の名前を目的語にする（salesRepository.create →「売上を登録する」）。
 * 動詞で始まらない名前は訳せないので undefined を返す。
 */
export function translateStep(name: string, receiverName?: string): string | undefined {
  const phrase = parseVerbPhrase(name, receiverName === undefined ? [] : objectWords(receiverName))
  return phrase === undefined ? undefined : renderVerbPhrase(phrase, 'step')
}

/** 動詞で始まる名前かどうか（関数名の文法の検査に使う）。 */
export function startsWithVerb(name: string): boolean {
  const [first] = splitWords(name)
  return first !== undefined && wordIndex.get(first)?.pos === 'verb'
}
