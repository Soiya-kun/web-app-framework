// packages/backend/src の usecase・domain を訳し、docs/generated/backend-process.md に書く。
// --check を付けると、書かずに最新かどうかだけを確かめる（CI 用）。
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderMarkdown } from './renderMarkdown'
import { translateSource } from './translateSource'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceRoot = join(repositoryRoot, 'packages/backend/src')
const targetDirectories = ['usecase', 'domain']
const outputFile = join(repositoryRoot, 'docs/generated/backend-process.md')

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory)
    .sort()
    .flatMap((entry) => {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) {
        return listSourceFiles(path)
      }
      return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : []
    })
}

const files = targetDirectories.flatMap((directory) =>
  listSourceFiles(join(sourceRoot, directory)).map((path) => ({
    path: relative(sourceRoot, path),
    functions: translateSource(readFileSync(path, 'utf8'), path),
  })),
)
const output = renderMarkdown(files, `packages/backend/src の ${targetDirectories.join('・')}`)
const functionCount = files.reduce((count, file) => count + file.functions.length, 0)

if (process.argv.includes('--check')) {
  const current = readFileSync(outputFile, 'utf8')
  if (current !== output) {
    console.error('docs/generated/backend-process.md がソースと一致しません。pnpm translate を実行してください。')
    process.exit(1)
  }
  console.log(`処理の日本語訳は最新です（関数 ${functionCount}）。`)
} else {
  mkdirSync(dirname(outputFile), { recursive: true })
  writeFileSync(outputFile, output)
  console.log(`docs/generated/backend-process.md を作りました（関数 ${functionCount}）。`)
}
