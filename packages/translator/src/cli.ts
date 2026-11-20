// packages/backend/src の usecase・domain を訳し、docs/generated/backend-process.md（日本語）と backend-process.en.md（英語）に書く。
// --check を付けると、書かずに最新かどうかだけを確かめる（CI 用）。
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { locales, prepareLanguage } from './language'
import { renderMarkdown } from './renderMarkdown'
import { translateSource } from './translateSource'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceRoot = join(repositoryRoot, 'packages/backend/src')
const targetDirectories = ['usecase', 'domain']
const outputFiles = { ja: 'docs/generated/backend-process.md', en: 'docs/generated/backend-process.en.md' } as const

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

const sourcePaths = targetDirectories.flatMap((directory) => listSourceFiles(join(sourceRoot, directory)))
const sourceDescription = `packages/backend/src の ${targetDirectories.join('・')}`
let stale = false
for (const locale of locales) {
  const language = prepareLanguage(locale)
  const files = sourcePaths.map((path) => ({ path: relative(sourceRoot, path), functions: translateSource(readFileSync(path, 'utf8'), path, language) }))
  const output = renderMarkdown(files, locale === 'ja' ? sourceDescription : `the ${targetDirectories.join(' and ')} of packages/backend/src`, locale)
  const functionCount = files.reduce((count, file) => count + file.functions.length, 0)
  const outputFile = join(repositoryRoot, outputFiles[locale])
  if (process.argv.includes('--check')) {
    let current = ''
    try {
      current = readFileSync(outputFile, 'utf8')
    } catch {
      current = ''
    }
    if (current !== output) {
      console.error(`${outputFiles[locale]} がソースと一致しません。pnpm translate を実行してください。`)
      stale = true
    } else {
      console.log(`処理の訳（${locale}）は最新です（関数 ${functionCount}）。`)
    }
  } else {
    mkdirSync(dirname(outputFile), { recursive: true })
    writeFileSync(outputFile, output)
    console.log(`${outputFiles[locale]} を作りました（関数 ${functionCount}）。`)
  }
}
if (stale) {
  process.exit(1)
}
