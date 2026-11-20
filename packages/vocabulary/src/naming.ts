// コードの名前を扱う道具（lint・翻訳ツール・SQL の台帳の検査が使う）。すべて既定の索引（単語帳のマスタ）で読む。
import { findUnknownWords, readName, type NounPhrase } from './analyze'
import { defaultLexicon } from './defaultLexicon'
import { renderEnglishLabel, renderEnglishStep, renderEnglishTitle } from './english'
import en from './generated/locale/en.json'
import ja from './generated/locale/ja.json'
import type { MessageKey } from './generated/catalogKey'
import { renderJapaneseLabel, renderJapaneseStep, renderJapaneseTitle } from './japanese'
import { splitWords } from './split'
import type { Locale } from './types'

/** 名前の中の、単語帳にない単語。 */
export function findUnknownTokens(name: string): string[] {
  return findUnknownWords(defaultLexicon, name)
}

/** 名前の中の、使わせない単語と、代わりに使う単語。 */
export function findAvoidedTokens(name: string): { readonly word: string; readonly preferred: string }[] {
  return splitWords(name).flatMap((word) => {
    const preferred = defaultLexicon.avoided.get(word)
    return preferred === undefined ? [] : [{ word, preferred }]
  })
}

/** 原形の動詞で始まる名前かどうか（関数名の文法の検査に使う）。 */
export function startsWithVerb(name: string): boolean {
  const { reading } = readName(defaultLexicon, name, 'verb')
  return reading?.kind === 'verbPhrase'
}

/** 名前を名詞句として見出しにする（salesAmount →「売上金額」/ "Sales Amount"）。読めない単語は ‹word› と印を付ける。 */
export function renderNounPhrase(name: string, locale: Locale): string {
  const { reading, unknown } = readName(defaultLexicon, name, 'noun')
  if (reading === null || reading.kind !== 'nounPhrase') {
    return `‹${unknown.join('・') || name}›`
  }
  return locale === 'ja' ? renderJapaneseLabel(reading.phrase) : renderEnglishLabel(reading.phrase)
}

/** 関数名を見出しにする。日本語は体言止め（createNewTransportSales →「新輸送売上の登録」）、英語は命令形（"Create New Transport Sales"）。 */
export function translateFunctionName(name: string, locale: Locale = 'ja'): string {
  const { reading } = readName(defaultLexicon, name, 'verb')
  if (reading === null) {
    return renderNounPhrase(name, locale)
  }
  if (reading.kind === 'verbPhrase') {
    return locale === 'ja' ? renderJapaneseTitle(reading.phrase) : renderEnglishTitle(reading.phrase)
  }
  return locale === 'ja' ? renderJapaneseLabel(reading.phrase) : renderEnglishLabel(reading.phrase)
}

/** 受け手の名前から、役割の語（repository など）を除いた名詞句（salesRepository →「売上」）。 */
function readReceiver(receiverName: string): NounPhrase | undefined {
  const { reading } = readName(defaultLexicon, receiverName, 'noun')
  if (reading?.kind !== 'nounPhrase') {
    return undefined
  }
  return { ...reading.phrase, units: reading.phrase.units.filter((unit) => !unit.concept.role) }
}

/**
 * 呼び出しを手順にする。日本語は「〜する」（validateSalesRequest →「売上リクエストをバリデーションする」）、英語は命令形（"Validate sales request"）。
 * メソッド名が動詞だけのときは、受け手の名前を目的語にする（salesRepository.create →「売上を登録する」）。
 * 動詞で始まらない名前は訳せないので undefined を返す。
 */
export function translateStep(name: string, receiverName?: string, locale: Locale = 'ja'): string | undefined {
  const { reading } = readName(defaultLexicon, name, 'verb')
  if (reading?.kind !== 'verbPhrase') {
    return undefined
  }
  const object = reading.phrase.object
  const isBare = object.units.length === 0 && object.modifiers.length === 0 && object.relations.length === 0 && object.predicate === null
  const receiver = receiverName === undefined ? undefined : readReceiver(receiverName)
  const phrase = isBare && receiver !== undefined ? { ...reading.phrase, object: receiver } : reading.phrase
  return locale === 'ja' ? renderJapaneseStep(phrase) : renderEnglishStep(phrase)
}

const catalogs = { ja, en } as const

/** 画面の文（生成した文言の表から引く）。 */
export function readMessage(locale: Locale, key: MessageKey): string {
  return (catalogs[locale].message as Readonly<Record<string, string>>)[key] ?? key
}

/** 文の一覧（翻訳ツールが throw の訳に使う）。 */
export function listMessages(locale: Locale): Readonly<Record<string, string>> {
  return catalogs[locale].message as Readonly<Record<string, string>>
}
