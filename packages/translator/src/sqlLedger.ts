// SQL の台帳を作る。
// 1. packages/backend/src/repository/postgres の defineStatement をすべて集め、名前と全文を docs/generated/sql-ledger.md に書く。
//    SQL の本文が固定の文字列でない（式を埋め込んでいる）ときは止める。
// 2. マイグレーションのテーブル名・列名・索引名・区分値が、単語帳の単語だけでできているかを確かめる。
// --check を付けると、書かずに最新かどうかだけを確かめる（CI 用）。
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findUnknownTokens } from '@app/vocabulary'
import ts from 'typescript'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const statementRoot = join(repositoryRoot, 'packages/backend/src/repository/postgres')
const migrationRoot = join(repositoryRoot, 'packages/backend/database/migration')
const outputFile = join(repositoryRoot, 'docs/generated/sql-ledger.md')

type LedgerEntry = { readonly name: string; readonly text: string; readonly path: string; readonly line: number }

const problems: string[] = []

function listFiles(directory: string, extension: string): string[] {
  return readdirSync(directory)
    .sort()
    .flatMap((entry) => {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) {
        return listFiles(path, extension)
      }
      return path.endsWith(extension) ? [path] : []
    })
}

function collectStatements(path: string): LedgerEntry[] {
  const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  const entries: LedgerEntry[] = []
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'defineStatement') {
      const [nameNode, textNode] = node.arguments
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      const where = `${relative(repositoryRoot, path)}:${line}`
      if (nameNode === undefined || !ts.isStringLiteral(nameNode)) {
        problems.push(`${where}: SQL の名前は文字列リテラルにする`)
        return
      }
      if (textNode === undefined || !(ts.isStringLiteral(textNode) || ts.isNoSubstitutionTemplateLiteral(textNode))) {
        problems.push(`${where}: SQL「${nameNode.text}」の本文は、式を埋め込まない固定の文字列にする`)
        return
      }
      entries.push({ name: nameNode.text, text: textNode.text.trim(), path: relative(repositoryRoot, path), line })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return entries
}

const entries = listFiles(statementRoot, '.ts').flatMap(collectStatements)

const nameCount = new Map<string, number>()
for (const entry of entries) {
  nameCount.set(entry.name, (nameCount.get(entry.name) ?? 0) + 1)
}
for (const [name, count] of nameCount) {
  if (count > 1) {
    problems.push(`SQL の名前「${name}」が ${count} か所にある`)
  }
}

// マイグレーションの名前の検査。
const sqlKeywords = new Set(['primary', 'unique', 'check', 'constraint', 'foreign'])

function checkDatabaseName(name: string, where: string): void {
  for (const word of findUnknownTokens(name)) {
    problems.push(`${where}: 「${name}」の単語「${word}」が単語帳にない`)
  }
}

for (const path of listFiles(migrationRoot, '.sql')) {
  const lines = readFileSync(path, 'utf8').split('\n')
  let insideTable = false
  lines.forEach((rawLine, index) => {
    const line = rawLine.replace(/--.*$/, '')
    const where = `${relative(repositoryRoot, path)}:${index + 1}`
    const tableMatch = /CREATE TABLE (\w+)/.exec(line)
    if (tableMatch?.[1] !== undefined) {
      checkDatabaseName(tableMatch[1], where)
      insideTable = true
      return
    }
    const indexMatch = /CREATE (?:UNIQUE )?INDEX (\w+)/.exec(line)
    if (indexMatch?.[1] !== undefined) {
      checkDatabaseName(indexMatch[1], where)
    }
    if (insideTable && /^\);/.test(line.trim())) {
      insideTable = false
      return
    }
    const columnMatch = /^\s+([a-z_]+)\s+(text|smallint|integer|bigint|date|boolean)\b/.exec(line)
    if (insideTable && columnMatch?.[1] !== undefined && !sqlKeywords.has(columnMatch[1])) {
      checkDatabaseName(columnMatch[1], where)
    }
    for (const valueList of line.matchAll(/IN \(([^)]*)\)/g)) {
      for (const value of (valueList[1] ?? '').matchAll(/'(\w+)'/g)) {
        checkDatabaseName(value[1] ?? '', where)
      }
    }
  })
}

if (problems.length > 0) {
  console.error(`SQL の台帳に ${problems.length} 件の問題があります。`)
  for (const problem of problems) {
    console.error(`- ${problem}`)
  }
  process.exit(1)
}

const sections = entries.map((entry) =>
  [`## ${entry.name}`, '', `[${entry.path}:${entry.line}](../../${entry.path}#L${entry.line})`, '', '```sql', entry.text, '```', ''].join(
    '\n',
  ),
)
const output = [
  '# SQL の台帳',
  '',
  '> 生成物。`pnpm sql:ledger` で packages/backend/src/repository/postgres の defineStatement から作る。手で編集しない。',
  '> repository が実行する SQL は、ここにあるものだけ（Executor は defineStatement で定義した SQL しか受け付けない）。',
  '',
  `SQL の数: ${entries.length}`,
  '',
  ...sections,
].join('\n')

if (process.argv.includes('--check')) {
  const current = readFileSync(outputFile, 'utf8')
  if (current !== output) {
    console.error('docs/generated/sql-ledger.md がソースと一致しません。pnpm sql:ledger を実行してください。')
    process.exit(1)
  }
  console.log(`SQL の台帳は最新です（SQL ${entries.length}）。`)
} else {
  mkdirSync(dirname(outputFile), { recursive: true })
  writeFileSync(outputFile, output)
  console.log(`docs/generated/sql-ledger.md を作りました（SQL ${entries.length}）。`)
}
