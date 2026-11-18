// 単語帳（words/・phrases.yaml・messages.yaml）を検証し、src/generated/vocabularyData.ts を作る。
// --check を付けると、生成物が最新かどうかだけを確かめる（CI 用）。
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import type { MessageEntry, PartOfSpeech, PhraseEntry, WordEntry, WordKind } from './types'
import { splitWords } from './split'

const packageDirectory = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputFile = join(packageDirectory, 'src/generated/vocabularyData.ts')
const partsOfSpeech: readonly PartOfSpeech[] = ['verb', 'noun', 'adjective', 'preposition']

type RawRecord = Record<string, unknown>

const problems: string[] = []

function readYamlList(file: string): RawRecord[] {
  const parsed: unknown = parse(readFileSync(file, 'utf8'))
  if (parsed === null || parsed === undefined) {
    return []
  }
  if (!Array.isArray(parsed)) {
    problems.push(`${file}: 先頭は配列にする`)
    return []
  }
  return parsed as RawRecord[]
}

function text(record: RawRecord, key: string, where: string, required: boolean): string {
  const value = record[key]
  if (value === undefined || value === null) {
    if (required) {
      problems.push(`${where}: ${key} がない`)
    }
    return ''
  }
  if (typeof value !== 'string') {
    problems.push(`${where}: ${key} は文字列にする`)
    return ''
  }
  return value
}

function textList(record: RawRecord, key: string, where: string): string[] {
  const value = record[key]
  if (value === undefined || value === null) {
    return []
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    problems.push(`${where}: ${key} は文字列の配列にする`)
    return []
  }
  return value as string[]
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function readWords(kind: WordKind): WordEntry[] {
  const directory = join(packageDirectory, 'words', kind)
  const files = readdirSync(directory).filter((file) => file.endsWith('.yaml')).sort()
  return files.flatMap((file) =>
    readYamlList(join(directory, file)).map((record, index) => {
      const where = `words/${kind}/${file}[${index}]`
      const word = text(record, 'word', where, true)
      const pos = text(record, 'pos', where, true) as PartOfSpeech
      if (!/^[a-z]+$/.test(word)) {
        problems.push(`${where}: word は英小文字だけにする（${word}）`)
      }
      if (!partsOfSpeech.includes(pos)) {
        problems.push(`${where}: pos は ${partsOfSpeech.join('・')} のどれかにする（${pos}）`)
      }
      const entry: WordEntry = {
        word,
        kind,
        pos,
        forms: textList(record, 'forms', where),
        ja: text(record, 'ja', where, true),
        jaVerb: text(record, 'jaVerb', where, pos === 'verb' || pos === 'preposition'),
        jaName: text(record, 'jaName', where, pos === 'preposition'),
        en: text(record, 'en', where, false) || capitalize(word),
        role: record['role'] === true,
        avoid: textList(record, 'avoid', where),
        description: text(record, 'description', where, kind === 'domain'),
      }
      return entry
    }),
  )
}

const wordList = [...readWords('system'), ...readWords('domain')]

const formOwner = new Map<string, string>()
for (const entry of wordList) {
  for (const form of [entry.word, ...entry.forms]) {
    const owner = formOwner.get(form)
    if (owner !== undefined) {
      problems.push(`「${form}」が ${owner} と ${entry.word} の両方にある`)
    }
    formOwner.set(form, entry.word)
  }
}
for (const entry of wordList) {
  for (const avoided of entry.avoid) {
    if (formOwner.has(avoided)) {
      problems.push(`${entry.word} の avoid にある「${avoided}」が単語として登録されている`)
    }
  }
}

function checkTokens(name: string, where: string): void {
  for (const token of splitWords(name)) {
    if (!formOwner.has(token)) {
      problems.push(`${where}: 単語帳にない単語「${token}」`)
    }
  }
}

const phraseList: PhraseEntry[] = readYamlList(join(packageDirectory, 'phrases.yaml')).map((record, index) => {
  const where = `phrases.yaml[${index}]`
  const words = text(record, 'words', where, true).split(' ').filter((word) => word !== '')
  for (const word of words) {
    if (!formOwner.has(word)) {
      problems.push(`${where}: 単語帳にない単語「${word}」`)
    }
  }
  return { words, ja: text(record, 'ja', where, true), en: text(record, 'en', where, true) }
})

const messageList: MessageEntry[] = readYamlList(join(packageDirectory, 'messages.yaml')).map((record, index) => {
  const where = `messages.yaml[${index}]`
  const key = text(record, 'key', where, true)
  checkTokens(key, where)
  return { key, ja: text(record, 'ja', where, true), en: text(record, 'en', where, true) }
})

if (problems.length > 0) {
  console.error(`単語帳に ${problems.length} 件の問題があります。`)
  for (const problem of problems) {
    console.error(`- ${problem}`)
  }
  process.exit(1)
}

const output = `// 生成物。pnpm vocabulary:generate で words/・phrases.yaml・messages.yaml から作る。手で編集しない。
import type { MessageEntry, PhraseEntry, WordEntry } from '../types'

export const wordList: readonly WordEntry[] = ${JSON.stringify(wordList, null, 2)}

export const phraseList: readonly PhraseEntry[] = ${JSON.stringify(phraseList, null, 2)}

export const messageList = ${JSON.stringify(messageList, null, 2)} as const satisfies readonly MessageEntry[]

export type MessageKey = (typeof messageList)[number]['key']
`

if (process.argv.includes('--check')) {
  const current = readFileSync(outputFile, 'utf8')
  if (current !== output) {
    console.error('src/generated/vocabularyData.ts が単語帳と一致しません。pnpm vocabulary:generate を実行してください。')
    process.exit(1)
  }
  console.log(`単語帳は最新です（単語 ${wordList.length}・並び ${phraseList.length}・文 ${messageList.length}）。`)
} else {
  mkdirSync(dirname(outputFile), { recursive: true })
  writeFileSync(outputFile, output)
  console.log(`src/generated/vocabularyData.ts を作りました（単語 ${wordList.length}・並び ${phraseList.length}・文 ${messageList.length}）。`)
}
