// 英語の語形の索引。名前の中の単語の並び（"billing customer" など）から、概念とその形を引く。
import type { Concept, EnglishFormName } from './types'

export type Surface = {
  readonly concept: Concept
  readonly form: EnglishFormName
}

export type Lexicon = {
  readonly concepts: ReadonlyMap<string, Concept>
  /** 単語を空白でつないだ並び → 概念と形。 */
  readonly surfaces: ReadonlyMap<string, Surface>
  /** 並びの最大の単語数（最長一致に使う）。 */
  readonly longestSurface: number
  /** 使わせない単語 → 代わりに使う概念の ID。 */
  readonly avoided: ReadonlyMap<string, string>
}

/** 1段目: 名前の主な形（原形・複数形・名詞形）。同じ並びを2つの概念が持てば重なり（エラー）。 */
const primaryForms: readonly EnglishFormName[] = ['base', 'plural', 'third', 'noun']
/** 2段目: 動詞から作る形（過去形・-ing・-able・un-）。ほかの概念が先に持つ並びなら、その概念を優先する（unidentified は形容詞の「仮受」）。 */
const derivedForms: readonly EnglishFormName[] = ['past', 'participle', 'gerund', 'able', 'unPast']

export function prepareLexicon(concepts: readonly Concept[]): { readonly lexicon: Lexicon; readonly problems: string[] } {
  const surfaces = new Map<string, Surface>()
  const problems: string[] = []

  function claim(text: string | null, concept: Concept, form: EnglishFormName, strict: boolean): void {
    if (text === null) {
      return
    }
    const owner = surfaces.get(text)
    if (owner === undefined) {
      surfaces.set(text, { concept, form })
      return
    }
    if (strict && owner.concept.id !== concept.id) {
      problems.push(`英語の「${text}」が ${owner.concept.id} と ${concept.id} の両方にある`)
    }
  }

  for (const form of primaryForms) {
    for (const concept of concepts) {
      claim(concept.en[form === 'base' ? 'base' : form], concept, form, true)
    }
  }
  for (const form of derivedForms) {
    for (const concept of concepts) {
      claim(concept.en[form], concept, form, false)
    }
  }

  const avoided = new Map<string, string>()
  for (const concept of concepts) {
    for (const word of concept.avoid) {
      if (surfaces.has(word)) {
        problems.push(`${concept.id} の avoid にある「${word}」が単語として使える形になっている`)
      }
      avoided.set(word, concept.id)
    }
  }

  const longestSurface = Math.max(1, ...[...surfaces.keys()].map((text) => text.split(' ').length))
  return {
    lexicon: { concepts: new Map(concepts.map((concept) => [concept.id, concept])), surfaces, longestSurface, avoided },
    problems,
  }
}
