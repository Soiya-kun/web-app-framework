// 単語帳のマスタ（words/・messages.yaml）を検査し、生成物を作る。
// - src/generated/conceptData.ts: 語形をそろえた概念（lint・翻訳ツールが使う）
// - src/generated/locale/{ja,en}.json: 画面の文言の表（i18n 向けの変換の結果。画面はこれだけを読む）
// - src/generated/catalogKey.ts: 見出し・ボタン・文のキーの型
// --check を付けると、書かずに最新かどうかだけを確かめる（CI 用）。
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { findUnknownWords } from './analyze'
import { buildConcepts, type RawEntry, type RawFile } from './buildConcepts'
import { buildCatalogs, locales } from './catalog'
import { extractCatalogKeys } from './extractKeys'
import { prepareLexicon } from './lexicon'
import type { Category, Concept, MessageDefinition, MessageFrame, WordKind } from './types'

const packageDirectory = join(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = join(packageDirectory, '../..')
const generatedDirectory = join(packageDirectory, 'src/generated')
/** 見出し・ボタンのキーを集める、画面のコードの場所。 */
const screenSourceDirectories = ['apps/web/src']
const messageFrames: readonly MessageFrame[] = ['request', 'prompt', 'done', 'progress', 'missing']

const problems: string[] = []

function readYamlList(path: string): RawEntry[] {
  const parsed: unknown = parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(parsed)) {
    problems.push(`${path}: 先頭は配列にする`)
    return []
  }
  return parsed as RawEntry[]
}

function readWordFiles(kind: WordKind): RawFile[] {
  const directory = join(packageDirectory, 'words', kind)
  return readdirSync(directory)
    .filter((file) => file.endsWith('.yaml'))
    .sort()
    .map((file) => {
      const name = basename(file, '.yaml')
      const category = kind === 'system' ? (name as Category | 'compound') : null
      return { path: `words/${kind}/${file}`, kind, category, entries: readYamlList(join(directory, file)) }
    })
}

const built = buildConcepts([...readWordFiles('system'), ...readWordFiles('domain')])
problems.push(...built.problems)
const concepts = built.concepts
const prepared = prepareLexicon(concepts)
problems.push(...prepared.problems)
const lexicon = prepared.lexicon

// 日本語の側も、名詞の形・動詞の名詞形と辞書形・形容詞の形を、概念ごとに一意にする（日本語から英語へ1通りに戻せるように）。
const japaneseOwners = new Map<string, string>()
function claimJapanese(text: string | null, concept: Concept): void {
  if (text === null || text === '') {
    return
  }
  const owner = japaneseOwners.get(text)
  if (owner !== undefined && owner !== concept.id) {
    problems.push(`日本語の「${text}」が ${owner} と ${concept.id} の両方にある`)
  }
  japaneseOwners.set(text, concept.id)
}
for (const concept of concepts) {
  claimJapanese(concept.ja.form, concept)
  claimJapanese(concept.ja.noun, concept)
  claimJapanese(concept.ja.label, concept)
  claimJapanese(concept.ja.dictionary, concept)
}

const messages: MessageDefinition[] = readYamlList(join(packageDirectory, 'messages.yaml')).map((record, index) => {
  const where = `messages.yaml[${index}]`
  const key = typeof record['key'] === 'string' ? record['key'] : ''
  const unknown = findUnknownWords(lexicon, key)
  if (key === '' || unknown.length > 0) {
    problems.push(`${where}: 文のキー「${key}」に単語帳にない単語がある（${unknown.join('・')}）`)
  }
  const free = record['free'] as Record<string, unknown> | undefined
  if (free !== undefined) {
    if (typeof free['ja'] !== 'string' || typeof free['en'] !== 'string') {
      problems.push(`${where}: free には ja と en の両方を書く（${key}）`)
    }
    return { key, frame: null, verb: null, object: null, free: { ja: String(free['ja']), en: String(free['en']) } }
  }
  const frame = record['frame'] as MessageFrame
  const verb = typeof record['verb'] === 'string' ? record['verb'] : null
  const object = typeof record['object'] === 'string' ? record['object'] : null
  if (!messageFrames.includes(frame)) {
    problems.push(`${where}: frame は ${messageFrames.join('・')} のどれか（${key}）`)
  }
  if (frame !== 'missing' && (verb === null || lexicon.concepts.get(verb)?.category !== 'verb')) {
    problems.push(`${where}: verb に単語帳の動詞を書く（${key}）`)
  }
  if (object !== null && !object.startsWith('$') && lexicon.concepts.get(object) === undefined) {
    problems.push(`${where}: object は $値の名前 か単語帳の名詞の id にする（${key}）`)
  }
  return { key, frame, verb, object, free: null }
})

// 画面で使うキー: 画面のコードから集めたものと、値として画面に出る概念（区分値など）の id。
const extracted = extractCatalogKeys(repositoryRoot, screenSourceDirectories)
const conceptLabelKeys = concepts.filter((concept) => concept.category === 'noun' || concept.category === 'adjective').map((concept) => concept.id)
const labelKeys = [...new Set([...conceptLabelKeys, ...extracted.labels.keys()])].sort()
const actionKeys = [...extracted.actions.keys()].sort()
const catalogResult = buildCatalogs(lexicon, labelKeys, actionKeys, messages)
problems.push(
  ...catalogResult.problems.map((problem) => {
    const key = /「([A-Za-z]+)」/.exec(problem)?.[1] ?? ''
    const locations = extracted.labels.get(key) ?? extracted.actions.get(key) ?? []
    return locations.length === 0 ? problem : `${problem}（${locations.join('、')}）`
  }),
)

if (problems.length > 0) {
  console.error(`単語帳に ${problems.length} 件の問題があります。`)
  for (const problem of problems) {
    console.error(`- ${problem}`)
  }
  process.exit(1)
}

function unionType(name: string, keys: readonly string[]): string {
  return `export type ${name} =\n${keys.map((key) => `  | '${key}'`).join('\n')}\n`
}

const outputs: Record<string, string> = {
  'conceptData.ts': `// 生成物。pnpm vocabulary:generate で words/ から作る。手で編集しない。
import type { Concept } from '../types'

export const conceptList: readonly Concept[] = ${JSON.stringify(concepts, null, 2)}
`,
  'catalogKey.ts': `// 生成物。pnpm vocabulary:generate で作る。手で編集しない。
// 見出しのキーは、概念の id と、画面のコードの text.label('…')・labelKey('…') から集める。

${unionType('LabelKey', labelKeys)}
${unionType('ActionKey', actionKeys.length === 0 ? ['never'] : actionKeys)}
${unionType('MessageKey', messages.map((message) => message.key))}`,
  ...Object.fromEntries(
    locales.map((locale) => [`locale/${locale}.json`, `${JSON.stringify(catalogResult.catalogs[locale], null, 2)}\n`]),
  ),
}

const frameCount = messages.filter((message) => message.frame !== null).length
const summary = `概念 ${concepts.length}・見出し ${labelKeys.length}・ボタン ${actionKeys.length}・文 ${messages.length}（文の型 ${frameCount}・自由文 ${messages.length - frameCount}）`

if (process.argv.includes('--check')) {
  const stale = Object.entries(outputs).filter(([file, text]) => {
    try {
      return readFileSync(join(generatedDirectory, file), 'utf8') !== text
    } catch {
      return true
    }
  })
  if (stale.length > 0) {
    console.error(`単語帳の生成物が最新ではありません（${stale.map(([file]) => file).join('・')}）。pnpm vocabulary:generate を実行してください。`)
    process.exit(1)
  }
  console.log(`単語帳は最新です（${summary}）。`)
} else {
  for (const [file, text] of Object.entries(outputs)) {
    mkdirSync(dirname(join(generatedDirectory, file)), { recursive: true })
    writeFileSync(join(generatedDirectory, file), text)
  }
  console.log(`単語帳の生成物を作りました（${summary}）。`)
}
