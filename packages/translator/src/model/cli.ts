// コードのブラウザのモデルを作る（pnpm model）。書き方の規則に合わないところがあれば止める。
// --check を付けると、書かずに規則だけを確かめる（CI 用。pnpm flow:check）。
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildModel } from './buildModel'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const outputDirectory = join(repositoryRoot, 'apps/browser/generated')

const started = performance.now()
// 書き方の規則の問題と数は、日本語のモデルで確かめる（英語のモデルも同じ解析から作る）。
const model = buildModel(repositoryRoot, 'ja')
const elapsed = Math.round(performance.now() - started)
const { progress } = model
const summary = `業務フロー ${progress.flows}（段 ${progress.flowSteps}）・シナリオ ${progress.scenarios}（未着手 ${progress.pendingScenarios}）・拡張 ${progress.extensions}（未着手 ${progress.pendingExtensions}）・ケース ${progress.cases}（未着手 ${progress.pendingCases}）・処理 ${model.works.length}・SQL ${model.statements.length}・議事録 ${progress.meetings}・課題 ${progress.questions}（未解決 ${progress.openQuestions}）・現行の業務フロー ${progress.legacyFlows}・旧システムのテーブル ${progress.legacyTables}・見積 ${progress.estimates}（未見積のシナリオ ${progress.unestimatedScenarios}）・工数 監査 ${progress.auditEffort}・人手 ${progress.manualEffort} 人日（工数のないシナリオ ${progress.missingEffortScenarios}）`

if (model.problems.length > 0) {
  console.error(`業務フローの書き方の規則に ${model.problems.length} 件の問題があります。`)
  for (const problem of model.problems) {
    console.error(`- ${problem.file}:${problem.line} [${problem.rule}] ${problem.message}`)
  }
}
if (!process.argv.includes('--check')) {
  mkdirSync(outputDirectory, { recursive: true })
  writeFileSync(join(outputDirectory, 'model.ja.json'), `${JSON.stringify(model, null, 2)}\n`)
  writeFileSync(join(outputDirectory, 'model.en.json'), `${JSON.stringify(buildModel(repositoryRoot, 'en'), null, 2)}\n`)
  console.log(`apps/browser/generated/model.ja.json・model.en.json を作りました（${summary}。${elapsed}ms）。`)
} else {
  console.log(`業務フローの書き方を確かめました（${summary}。${elapsed}ms）。`)
}
if (model.problems.length > 0) {
  process.exit(1)
}
