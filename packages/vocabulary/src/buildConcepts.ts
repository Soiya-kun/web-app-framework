// 単語帳の YAML の項目から、語形をそろえた概念を作る。生成（generate.ts）だけが使う。
import {
  conjugateJapanese,
  inflectJapaneseAdjective,
  makeEnglishAble,
  makeEnglishGerund,
  makeEnglishPast,
  pluralizeEnglish,
  titleCase,
} from './morphology'
import type {
  Category,
  Concept,
  EnglishForms,
  JapaneseAdjectiveClass,
  JapaneseForms,
  JapaneseVerbClass,
  WordKind,
} from './types'

export type RawEntry = Readonly<Record<string, unknown>>

export type RawFile = {
  readonly path: string
  readonly kind: WordKind
  /** ファイル名で決まる品詞（noun.yaml など）。domain のファイルは項目ごとに category を書く。 */
  readonly category: Category | 'compound' | null
  readonly entries: readonly RawEntry[]
}

const categories: readonly Category[] = ['noun', 'verb', 'adjective', 'preposition']

const emptyJapanese: JapaneseForms = {
  form: null,
  attach: null,
  verbClass: null,
  noun: null,
  label: null,
  dictionary: null,
  te: null,
  past: null,
  potential: null,
  politePast: null,
  negative: null,
  perfective: null,
  perfectiveLabel: null,
  negativePerfective: null,
  negativePerfectiveLabel: null,
  adjectiveClass: null,
  attributive: null,
  predicative: null,
  nounPattern: null,
  stepPattern: null,
  titlePattern: null,
}

function readRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function readText(record: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : null
}

export function buildConcepts(files: readonly RawFile[]): { readonly concepts: Concept[]; readonly problems: string[] } {
  const concepts: Concept[] = []
  const problems: string[] = []

  for (const file of files) {
    file.entries.forEach((entry, index) => {
      const where = `${file.path}[${index}]`
      const id = readText(entry, 'id')
      if (id === null || !/^[a-z][A-Za-z]*$/.test(id)) {
        problems.push(`${where}: id は英字の camelCase にする（${String(id)}）`)
        return
      }
      if (concepts.some((concept) => concept.id === id)) {
        problems.push(`${where}: id「${id}」がほかの項目と同じ（1つの概念は1か所にだけ書く）`)
        return
      }
      const isCompound = file.category === 'compound'
      const category = (isCompound ? 'noun' : (file.category ?? readText(entry, 'category'))) as Category
      if (!categories.includes(category)) {
        problems.push(`${where}: category は ${categories.join('・')} のどれかにする（${id}）`)
        return
      }
      const enRaw = readRecord(entry['en'])
      const jaRaw = readRecord(entry['ja'])
      const tokens = isCompound ? (readText(enRaw, 'tokens') ?? '').split(' ').filter((token) => token !== '') : [id]
      if (isCompound && tokens.length < 2) {
        problems.push(`${where}: 複合語は en.tokens に2語以上を書く（${id}）`)
        return
      }
      const base = tokens.join(' ')
      const head = tokens.at(-1) ?? id
      const lead = tokens.slice(0, -1).join(' ')
      const withLead = (word: string) => (lead === '' ? word : `${lead} ${word}`)
      const label = readText(enRaw, 'label') ?? titleCase(base)

      let en: EnglishForms = {
        base,
        label,
        plural: null,
        third: null,
        past: null,
        participle: null,
        gerund: null,
        able: null,
        unPast: null,
        noun: null,
      }
      let ja: JapaneseForms = emptyJapanese

      if (category === 'noun') {
        en = { ...en, plural: withLead(readText(enRaw, 'plural') ?? pluralizeEnglish(head)) }
        const form = readText(jaRaw, 'form')
        if (form === null) {
          problems.push(`${where}: 名詞は ja.form を書く（${id}）`)
        }
        ja = { ...emptyJapanese, form, attach: readText(jaRaw, 'attach') === 'direct' ? 'direct' : 'no', label: form }
      }

      if (category === 'verb') {
        const past = readText(enRaw, 'past') ?? makeEnglishPast(id)
        const gerund = readText(enRaw, 'gerund') ?? makeEnglishGerund(id)
        en = {
          ...en,
          third: readText(enRaw, 'third') ?? pluralizeEnglish(id),
          past,
          participle: readText(enRaw, 'participle') ?? past,
          gerund,
          able: readText(enRaw, 'able') ?? makeEnglishAble(id),
          unPast: `un${readText(enRaw, 'participle') ?? past}`,
          noun: readText(enRaw, 'noun') ?? gerund,
        }
        const verbClass = readText(jaRaw, 'class') as JapaneseVerbClass | null
        const stemOrDictionary = verbClass === 'suru' ? readText(jaRaw, 'stem') : readText(jaRaw, 'dictionary')
        if (verbClass === null || !['suru', 'ichidan', 'godan'].includes(verbClass) || stemOrDictionary === null) {
          problems.push(`${where}: 動詞は ja.class（suru・ichidan・godan）と、suru なら ja.stem、それ以外は ja.dictionary を書く（${id}）`)
        } else {
          try {
            const forms = conjugateJapanese(verbClass, stemOrDictionary, readText(jaRaw, 'noun'))
            ja = {
              ...emptyJapanese,
              ...forms,
              verbClass,
              attach: verbClass === 'suru' ? 'direct' : 'no',
              label: readText(jaRaw, 'label') ?? forms.noun,
            }
          } catch (error) {
            problems.push(`${where}: ${(error as Error).message}`)
          }
        }
      }

      if (category === 'adjective') {
        const adjectiveClass = readText(jaRaw, 'class') as JapaneseAdjectiveClass | null
        const stem = readText(jaRaw, 'stem')
        if (adjectiveClass === null || !['no', 'na', 'i', 'prefix'].includes(adjectiveClass) || stem === null) {
          problems.push(`${where}: 形容詞は ja.class（no・na・i・prefix）と ja.stem を書く（${id}）`)
        } else {
          const forms = inflectJapaneseAdjective(adjectiveClass, stem, readText(jaRaw, 'predicative'))
          ja = { ...emptyJapanese, adjectiveClass, ...forms }
        }
      }

      if (category === 'preposition') {
        const nounPattern = readText(jaRaw, 'noun')
        const stepPattern = readText(jaRaw, 'step')
        const titlePattern = readText(jaRaw, 'title')
        if (nounPattern === null || stepPattern === null || titlePattern === null) {
          problems.push(`${where}: 前置詞は ja.noun・ja.step・ja.title の型を書く（${id}）`)
        }
        ja = { ...emptyJapanese, nounPattern, stepPattern, titlePattern }
        en = { ...en, label: base }
      }

      const description = readText(entry, 'description') ?? ''
      if (file.kind === 'domain' && description === '') {
        problems.push(`${where}: 業務の単語は description を書く（${id}）`)
      }
      const avoid = Array.isArray(entry['avoid']) ? (entry['avoid'] as unknown[]).map(String) : []
      concepts.push({ id, kind: file.kind, category, tokens, en, ja, role: entry['role'] === true, avoid, description })
    })
  }
  return { concepts, problems }
}
