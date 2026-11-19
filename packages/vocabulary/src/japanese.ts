// 意味の木を日本語にする。見出し（名詞句）・関数の題（体言止め）・処理の手順（〜する）・ボタン。
import type { Modifier, NounPhrase, NounUnit, Relation, VerbPhrase } from './analyze'
import type { Concept } from './types'

function fill(pattern: string, values: Readonly<Record<string, string>>): string {
  return pattern.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)
}

/** 名詞の前に置く形（発行前の・未発行の・締められる・今回）。 */
function attributiveOf(modifier: Modifier): string {
  const ja = modifier.concept.ja
  switch (modifier.derivation) {
    case 'adjective':
      return ja.attributive ?? ''
    case 'perfective':
      return ja.perfective ?? ''
    case 'negativePerfective':
      return ja.negativePerfective ?? ''
    case 'potential':
      return ja.potential ?? ''
  }
}

/** 単独で見出しにする形（未発行・仮受）。 */
function labelOfModifier(modifier: Modifier): string {
  const ja = modifier.concept.ja
  switch (modifier.derivation) {
    case 'adjective':
      return ja.label ?? ''
    case 'perfective':
      return ja.perfectiveLabel ?? ''
    case 'negativePerfective':
      return ja.negativePerfectiveLabel ?? ''
    case 'potential':
      return ja.potential ?? ''
  }
}

function formOf(unit: NounUnit): string {
  return (unit.nominalized ? unit.concept.ja.noun : unit.concept.ja.form) ?? ''
}

/** 名詞をつなぐ。つながる側が direct なら「の」なし（売上金額）、それ以外は「の」（振込依頼人の顧客）。 */
function joinUnits(units: readonly NounUnit[]): string {
  return units.reduce(
    (text, unit, index) => (index === 0 ? formOf(unit) : `${text}${unit.concept.ja.attach === 'direct' ? '' : 'の'}${formOf(unit)}`),
    '',
  )
}

function coreOf(phrase: NounPhrase): string {
  if (phrase.units.length === 0) {
    return phrase.modifiers.map(labelOfModifier).join('')
  }
  return `${phrase.modifiers.map(attributiveOf).join('')}${joinUnits(phrase.units)}`
}

function applyNounRelations(head: string, relations: readonly Relation[]): string {
  return relations.reduce(
    (text, relation) => fill(relation.preposition.ja.nounPattern ?? '{head}', { head: text, object: renderJapaneseLabel(relation.object) }),
    head,
  )
}

/** 名詞句を見出しにする（salesAmount →「売上金額」、unissued →「未発行」）。 */
export function renderJapaneseLabel(phrase: NounPhrase): string {
  const core = coreOf(phrase)
  const withPredicate = phrase.predicate === null ? core : `${attributiveOf(phrase.predicate)}${core}`
  return applyNounRelations(withPredicate, phrase.relations)
}

/** 名詞句の述語を節にする（closingCancelable →「締めを取り消せる」、closable →「締められる」）。 */
function renderClause(phrase: NounPhrase): string {
  const core = applyNounRelations(coreOf(phrase), phrase.relations)
  const predicate = phrase.predicate
  if (predicate === null) {
    return core
  }
  const ja = predicate.concept.ja
  switch (predicate.derivation) {
    case 'potential':
      return core === '' ? (ja.potential ?? '') : `${core}を${ja.potential ?? ''}`
    case 'perfective':
      return core === '' ? (ja.perfectiveLabel ?? '') : `${core}が${ja.perfectiveLabel ?? ''}である`
    case 'negativePerfective':
      return core === '' ? (ja.negativePerfectiveLabel ?? '') : `${core}が${ja.negativePerfectiveLabel ?? ''}である`
    case 'adjective':
      return core === '' ? (ja.predicative ?? '') : `${core}が${ja.predicative ?? ''}`
  }
}

function renderVerbPhrase(phrase: VerbPhrase, form: 'title' | 'step'): string {
  const verb = phrase.verb.ja
  const verbText = (form === 'title' ? verb.noun : verb.dictionary) ?? ''
  const object = phrase.object
  if (object.predicate !== null) {
    return form === 'title' ? `${renderClause(object)}ことの${verbText}` : `${renderClause(object)}ことを${verbText}`
  }
  const [first, ...others] = object.relations
  const head = applyNounRelations(coreOf(object), others)
  if (first === undefined) {
    if (head === '') {
      return form === 'title' ? (verb.label ?? verbText) : verbText
    }
    return form === 'title' ? `${head}の${verbText}` : `${head}を${verbText}`
  }
  const pattern = (form === 'title' ? first.preposition.ja.titlePattern : first.preposition.ja.stepPattern) ?? ''
  const usable = head === '' ? pattern.replace(/\{head\}[をの]/, '') : pattern
  return fill(usable, { head, object: renderJapaneseLabel(first.object), verb: verbText })
}

/** 関数の題（体言止め。createNewTransportSales →「新輸送売上の登録」）。 */
export function renderJapaneseTitle(phrase: VerbPhrase): string {
  return renderVerbPhrase(phrase, 'title')
}

/** 処理の手順（〜する。validateSalesRequest →「売上リクエストをバリデーションする」）。 */
export function renderJapaneseStep(phrase: VerbPhrase): string {
  return renderVerbPhrase(phrase, 'step')
}

/** ボタンの文言（動詞の名詞形か上書き。issue →「発行」、close →「締め処理」）。 */
export function renderJapaneseAction(verb: Concept): string {
  return verb.ja.label ?? verb.ja.noun ?? ''
}
