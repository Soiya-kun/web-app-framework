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

  test('担当は役割の値から求め、議事録の課題は関係する業務フロー・シナリオ・拡張に付き、回答は後の回から求める', () => {
    expect(model.roles.map((role) => [role.id, role.side])).toContainEqual(['accountant', 'business'])
    expect(model.flows.find((flow) => flow.id === 'monthlyInvoice')?.steps[0]).toMatchObject({ actor: 'salesperson', actorTitle: '営業担当' })
    const mistakenRefund = model.questions.find((question) => question.id === 'meeting20261017.mistakenRefund')
    expect(mistakenRefund).toMatchObject({ assigneeId: 'approver', place: { kind: 'extension', scenarioId: 'registerPayment', extension: 'mistakenPayment' } })
    expect(mistakenRefund?.answer?.meetingId).toBe('meeting20261031')
    expect(model.questions.find((question) => question.id === 'meeting20261031.overdueReminder')).toMatchObject({ place: { kind: 'flow', flowId: 'overdueInvoice' }, answer: null })
    expect(model.meetings.find((meeting) => meeting.id === 'meeting20261031')?.approval).toBeNull()
  })

  test('英語のモデルは、同じつながりを英語の見出し・手順で持つ（人が書いた拡張の条件は書いたまま）', () => {
    const englishModel = buildModel(repositoryRoot, 'en')
    const scenario = englishModel.scenarios.find((candidate) => candidate.id === 'registerPayment')
    const monthly = englishModel.flows.find((flow) => flow.id === 'monthlyInvoice')

    expect(englishModel.locale).toBe('en')
    expect(scenario).toMatchObject({ title: 'Register payment', actorTitle: 'Accountant', actionEndpointIds: ['POST /api/payments'] })
    expect(scenario?.steps.at(-1)).toBe('Press “Register”')
    expect(monthly?.steps.slice(0, 3).map((step) => step.title)).toEqual(['Deliver product', 'Create sales', 'Closing Date arrives (2026-10-31)'])
    expect(scenario?.extensions[0]?.condition).toBe(model.scenarios.find((candidate) => candidate.id === 'registerPayment')?.extensions[0]?.condition)
    expect(englishModel.problems).toEqual(model.problems)
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
    'apps/web/role/role.ts',
    `import { defineRole } from '@app/flow'\nexport const salesperson = defineRole('salesperson', { side: 'business' })\nexport const engineer = defineRole('engineer', { side: 'vendor' })\n`,
  )
  put(
    'apps/web/scenario/sales/createSales.ts',
    `import { defineScenario } from '@app/flow'\nimport { salesperson } from '../../role/role'\nexport const createSales = defineScenario('createSales', { actor: salesperson })\n`,
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
  put(
    'apps/web/meeting/meeting20261003.ts',
    `import { decide, defineMeeting, raise } from '@app/flow'\nimport { createSales } from '../scenario/sales/createSales'\nimport { engineer, salesperson } from '../role/role'\nexport const meeting20261003 = defineMeeting('2026-10-03', {\n  title: '第1回',\n  attendees: [engineer, salesperson],\n  agenda: [createSales],\n  decisions: [decide(createSales, '決めたこと')],\n  questions: {\n    salesKind: raise(createSales, '区分はいくつか', { assignee: salesperson, deadline: '2026-10-10' }),\n    salesFoo: raise(createSales, '名前が単語帳にない', { assignee: salesperson, deadline: '2026-10-01' }),\n  },\n  approval: { on: '2026-10-05', by: engineer },\n})\n`,
  )
  put(
    'apps/web/meeting/meeting20261010.ts',
    `import { answer, defineMeeting } from '@app/flow'\nimport { salesperson } from '../role/role'\nimport { meeting20261003 } from './meeting20261003'\nexport const meetingSecond = defineMeeting('2026-10-10', {\n  title: '第2回',\n  attendees: [salesperson],\n  agenda: [],\n  answers: [answer(meeting20261003.questions.salesKind, '3つ'), answer(meeting20261003.questions.salesKind, 'もう一度')],\n})\n`,
  )

  const model = buildModel(fixtureRoot)
  const rules = (file: string) => model.problems.filter((problem) => problem.file === file).map((problem) => problem.rule)

  test('シナリオ: 単語帳と動詞で始まる名前・手順の並び・画面を開くところから・業務フローに入っているか', () => {
    expect(rules('apps/web/scenario/sales/tidySales.ts')).toEqual(['scenario-name', 'scenario-name', 'actor', 'scenario-flat', 'scenario-start', 'scenario-orphan'])
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

  test('議事録: 変数の名前は meeting と日付、課題の名前は単語帳の言葉、期限は打合せの日以後、承認は業務部門', () => {
    expect(rules('apps/web/meeting/meeting20261003.ts')).toEqual(['question-name', 'question-deadline', 'approval'])
  })

  test('議事録: 回答は、挙げた打合せより後の打合せで1回だけ', () => {
    expect(rules('apps/web/meeting/meeting20261010.ts')).toEqual(['meeting', 'answer'])
    expect(model.questions.find((question) => question.key === 'salesKind')?.answer).toMatchObject({ meetingId: 'meetingSecond', text: '3つ' })
  })

  test('未着手のシナリオ・ケースは数える（問題にはしない）', () => {
    expect(model.progress).toMatchObject({ scenarios: 2, pendingScenarios: 1, cases: 2, pendingCases: 2 })
  })
})
