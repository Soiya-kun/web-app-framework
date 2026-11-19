// 日本語の用語を、単語帳の概念の並びとして読む（日本語 → 英語の逆引き）。
// 単語帳の日本語の形（名詞・動詞の名詞形・形容詞・活用形）で最長一致に分け、名詞のつなぎの「の」は読み飛ばす。
import type { Concept } from './types'

type Piece = { readonly text: string; readonly concept: Concept; readonly english: string }

export type JapaneseReading = readonly { readonly concept: Concept; readonly english: string }[]

function collectPieces(concepts: readonly Concept[]): Piece[] {
  return concepts.flatMap((concept) => {
    const pieces: Piece[] = []
    const add = (text: string | null, english: string | null) => {
      const isNew = !pieces.some((piece) => piece.text === text && piece.english === english)
      if (text !== null && text !== '' && english !== null && isNew) {
        pieces.push({ text, concept, english })
      }
    }
    add(concept.ja.form, concept.en.base)
    add(concept.ja.noun, concept.en.base)
    add(concept.ja.label, concept.en.base)
    add(concept.ja.attributive, concept.en.base)
    add(concept.ja.perfective, concept.en.participle)
    add(concept.ja.perfectiveLabel, concept.en.participle)
    add(concept.ja.negativePerfective, concept.en.unPast)
    add(concept.ja.negativePerfectiveLabel, concept.en.unPast)
    return pieces
  })
}

/** 日本語を概念の並びに読む。読み方が複数あれば、少ない語数の読みだけを返す。 */
export function readJapanese(concepts: readonly Concept[], text: string): JapaneseReading[] {
  const pieces = collectPieces(concepts)
  const memo = new Map<string, JapaneseReading[]>()
  const segment = (rest: string): JapaneseReading[] => {
    if (rest === '') {
      return [[]]
    }
    const cached = memo.get(rest)
    if (cached !== undefined) {
      return cached
    }
    const body = rest.startsWith('の') ? rest.slice(1) : rest
    const results: JapaneseReading[] = []
    for (const piece of pieces) {
      if (body.startsWith(piece.text)) {
        for (const tail of segment(body.slice(piece.text.length))) {
          results.push([{ concept: piece.concept, english: piece.english }, ...tail])
        }
      }
    }
    memo.set(rest, results)
    return results
  }
  const readings = segment(text)
  const fewest = Math.min(...readings.map((reading) => reading.length))
  return readings.filter((reading) => reading.length === fewest)
}

/** 概念の並びを、英語の名前（camelCase）にする。 */
export function composeEnglishName(reading: JapaneseReading): string {
  return reading
    .flatMap((part) => part.english.split(' '))
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('')
}
