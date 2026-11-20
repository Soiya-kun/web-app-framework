// コードのブラウザのモデル（静的解析）を確かめる。このリポジトリのソースでのつながりと、書き方の規則の検査。
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'
import { buildModel } from '../src/model/buildModel'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('このリポジトリのモデル', () => {
  const model = buildModel(repositoryRoot)

  test('書き方の規則の問題がない', () => {
    expect(model.problems).toEqual([])
  })

  test('シナリオから、押すボタンの API の入口・処理・SQL までつながる', () => {
    const scenario = model.scenarios.find((candidate) => candidate.id === 'registerPayment')
    const work = model.works.find((candidate) => candidate.id === 'registerPayment')

    expect(scenario).toMatchObject({ title: '入金を記録する', actorTitle: '経理担当', pageIds: ['/payments/new'], actionEndpointIds: ['POST /api/payments'] })
    expect(scenario?.workIds).toContain('registerPayment')
    expect(work?.repositoryCalls.map((call) => [call.title, call.statementIds])).toEqual([
      ['選んだ顧客を取得する', ['findCustomer']],
      ['振込依頼人の顧客を取得する', ['findPayerCustomer']],
      ['入金を登録する', ['createPayment']],
      ['振込依頼人名を保存する', ['savePayerNames']],
    ])
  })

  test('SQL のテーブルは FROM・JOIN・INTO・UPDATE から求め、行のロック（FOR UPDATE OF）と upsert（DO UPDATE SET）は含めない', () => {
    const tableIds = new Set(model.statements.flatMap((statement) => statement.tableIds))

    expect(model.statements.find((statement) => statement.id === 'listUnbilledSales')?.tableIds).toEqual(['sales', 'customer'])
    expect([...tableIds].sort()).toEqual(model.tables.map((table) => table.id).sort())
  })

  test('業務フローの段は、シナリオか子フローにつながり、子フローは親を知っている', () => {
    const monthly = model.flows.find((flow) => flow.id === 'monthlyInvoice')
    const nested = model.flows.find((flow) => flow.id === 'paymentManagement')

    expect(monthly?.steps.map((step) => [step.number, step.kind, step.title])).toContainEqual(['8', 'nest', '入金管理'])
    expect(monthly?.steps.find((step) => step.number === '5')?.extensions.map((extension) => [extension.key, extension.resume])).toEqual([['5a', false]])
    expect(nested?.parentIds).toEqual(['monthlyInvoice'])
  })
})

describe('書き方の規則の検査', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'flow-model-'))
  afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }))
  const put = (file: string, content: string) => {
    mkdirSync(dirname(join(fixtureRoot, file)), { recursive: true })
    writeFileSync(join(fixtureRoot, file), content)
  }
  put(
    'apps/web/scenario/sales/createSales.ts',
    `import { defineScenario } from '@app/flow'\nexport const createSales = defineScenario('createSales', { actor: 'salesperson' })\n`,
  )
  put(
    'apps/web/scenario/sales/tidySales.ts',
    `import { defineScenario } from '@app/flow'\nexport const tidySales = defineScenario('tidySales', {\n  actor: 'salesperson',\n  operate: async (screen) => {\n    if (screen) {\n      await screen.press('create')\n    }\n  },\n})\n`,
  )
  put(
    'apps/web/scenario/sales/createSales.test.tsx',
    `import { createSales } from './createSales'\ndescribeScenario(createSales, (cases) => {\n  cases.main('登録する')\n  cases.main('もう1つ')\n})\ntest('直接書いたテスト', () => {})\n`,
  )
  put('apps/web/flow/registerSales.ts', `import { defineFlow, operate } from '@app/flow'\nimport { createSales } from '../scenario/sales/createSales'\nexport const registerSales = defineFlow('registerSales', { steps: [operate(createSales), elapse('closingDate', '10/31')] })\n`)
  put('apps/web/src/salesPage.test.tsx', `test('画面のテスト', () => {})\n`)

  const model = buildModel(fixtureRoot)
  const rules = (file: string) => model.problems.filter((problem) => problem.file === file).map((problem) => problem.rule)

  test('シナリオ: 単語帳と動詞で始まる名前・手順の並び・画面を開くところから・業務フローに入っているか', () => {
    expect(rules('apps/web/scenario/sales/tidySales.ts')).toEqual(['scenario-name', 'scenario-name', 'scenario-flat', 'scenario-start', 'scenario-orphan'])
  })

  test('ケース: describeScenario だけを書き、主成功シナリオは1つ', () => {
    expect(rules('apps/web/scenario/sales/createSales.test.tsx')).toEqual(['case-main', 'case-place'])
  })

  test('業務フロー: 名前は名詞句、領域のフォルダに置く、時の経過の日付は YYYY-MM-DD', () => {
    expect(rules('apps/web/flow/registerSales.ts')).toEqual(['flow-name', 'flow-place', 'elapse'])
  })

  test('画面のテストは scenario と flow にだけ置く', () => {
    expect(rules('apps/web/src/salesPage.test.tsx')).toEqual(['test-place'])
  })

  test('未着手のシナリオ・ケースは数える（問題にはしない）', () => {
    expect(model.progress).toMatchObject({ scenarios: 2, pendingScenarios: 1, cases: 2, pendingCases: 2 })
  })
})
