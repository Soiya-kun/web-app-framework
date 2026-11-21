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

  test('担当は役割の値から求め、議事録の課題と決めたことは指している場所に付き、課題の解決は後の回の決めたことから求める', () => {
    expect(model.roles.map((role) => [role.id, role.side])).toContainEqual(['accountant', 'business'])
    expect(model.flows.find((flow) => flow.id === 'monthlyInvoice')?.steps[0]).toMatchObject({ actor: 'salesperson', actorTitle: '営業担当' })
    const mistakenRefund = model.questions.find((question) => question.id === 'meeting20261017.mistakenRefund')
    expect(mistakenRefund).toMatchObject({ assigneeId: 'approver', places: [{ kind: 'extension', id: 'registerPayment', extension: 'mistakenPayment' }] })
    expect(mistakenRefund?.decision?.meetingId).toBe('meeting20261031')
    expect(model.questions.find((question) => question.id === 'meeting20261031.overdueReminder')).toMatchObject({ places: [{ kind: 'flow', id: 'overdueInvoice' }], decision: null })
    // 決めたことは、業務フロー・シナリオに加えて、画面・処理・規則も指せる。
    const places = model.meetings.flatMap((meeting) => meeting.decisions.flatMap((decision) => decision.places.map((place) => [place.kind, place.id])))
    expect(places).toEqual(expect.arrayContaining([['page', '/payments'], ['work', 'closeInvoice'], ['rule', 'packages/backend/src/domain/payment/payerPolicy.ts#decidePaymentCustomer']]))
  })

  test('現行の業務フローを新しい業務フローと比べ、同じ・置き換え・廃止の段と、新しい段を求める', () => {
    const legacy = model.legacyFlows.find((flow) => flow.id === 'legacyMonthlyInvoice')

    expect(legacy).toMatchObject({ title: '現行の月次の請求', area: 'invoice', replacementIds: ['monthlyInvoice'] })
    expect(legacy?.steps.map((step) => [step.title, step.change])).toEqual([
      ['商品を納品する', 'same'],
      ['売上を記入する', 'replaced'],
      ['請求締め日になる', 'same'],
      ['請求を印刷する', 'replaced'],
      ['請求をコピーする', 'discontinued'],
      ['請求を郵送する', 'replaced'],
      ['請求を支払う', 'same'],
      ['入金を記入する', 'replaced'],
    ])
    expect(legacy?.steps[3]?.replacements.map((replacement) => replacement.title)).toEqual(['請求を締める', '請求を発行する'])
    expect(legacy?.steps[3]?.tableIds).toEqual(['legacySales', 'legacyInvoice'])
    // 旧システムの画面の手順は、書いた文言のまま日本語の手順にする。
    expect(legacy?.steps[1]?.screenSteps).toEqual([
      '「売上伝票入力」を開く',
      '得意先コードに「000123」を入れる',
      '売上日に「20261015」を入れる',
      '品名に「運賃」を入れる',
      '金額に「100000」を入れる',
      '「登録(F12)」を押す',
    ])
    expect(legacy?.steps[1]?.guarantee).toEqual(['「登録しました」と出ることを確かめる'])
    expect(legacy?.steps[0]?.screenSteps).toEqual([])
    expect(legacy?.addedSteps.map((step) => [step.number, step.title])).toEqual([
      ['5', '請求を閲覧する'],
      ['8.3', '入金を閲覧する'],
    ])
    expect(model.flows.find((flow) => flow.id === 'monthlyInvoice')?.legacyIds).toEqual(['legacyMonthlyInvoice'])
    expect(model.legacyTables.find((table) => table.id === 'legacyPayment')?.columns.at(-1)?.replacement).toEqual({ tableId: 'adjustment', column: 'adjustment_amount' })
  })

  test('見積の項目は対象（業務フロー・シナリオ・画面・現行の業務フロー・旧システムのテーブル）を指し、いちばん新しい見積にないシナリオを数える', () => {
    expect(model.estimates.map((estimate) => [estimate.id, estimate.totalAmount])).toEqual([
      ['estimate20260920', 6_400_000],
      ['estimate20261031', 5_800_000],
    ])
    const latest = model.estimates.at(-1)
    expect(latest?.items.find((item) => item.title === '売上の登録')?.targets.map((target) => [target.kind, target.id])).toEqual([
      ['scenario', 'createSales'],
      ['page', '/sales/new'],
    ])
    expect(latest?.items.find((item) => item.title === '旧システムのデータの移行')?.targets.map((target) => target.kind)).toEqual(['legacyTable', 'legacyTable', 'legacyTable'])
    expect(model.estimates[0]?.items.find((item) => item.title === '現行の請求業務からの移行')?.targets).toMatchObject([{ kind: 'legacy', id: 'legacyMonthlyInvoice' }])
    expect(model.unestimatedScenarioIds).toEqual(['createAdjustment'])
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
    `import { decide, defineMeeting, raise } from '@app/flow'\nimport { createSales } from '../scenario/sales/createSales'\nimport { engineer, salesperson } from '../role/role'\nexport const meeting20261003 = defineMeeting('2026-10-03', {\n  title: '第1回',\n  attendees: [engineer, salesperson],\n  agenda: [createSales],\n  decisions: [decide(createSales, '決めたこと')],\n  questions: {\n    salesKind: raise(createSales, '区分はいくつか', { assignee: salesperson, deadline: '2026-10-10' }),\n    salesFoo: raise(createSales, '名前が単語帳にない', { assignee: salesperson, deadline: '2026-10-01' }),\n    salesTax: raise('createSales', '場所を文字で書いた', { assignee: salesperson, deadline: '2026-10-10' }),\n  },\n})\n`,
  )
  put(
    'apps/web/meeting/meeting20261010.ts',
    `import { decide, defineMeeting } from '@app/flow'\nimport { createSales } from '../scenario/sales/createSales'\nimport { salesperson } from '../role/role'\nimport { meeting20261003 } from './meeting20261003'\nexport const meetingSecond = defineMeeting('2026-10-10', {\n  title: '第2回',\n  attendees: [salesperson],\n  agenda: [],\n  decisions: [\n    decide(createSales, '3つ', { question: meeting20261003.questions.salesKind }),\n    decide(createSales, 'もう一度', { question: meeting20261003.questions.salesKind }),\n  ],\n})\n`,
  )

  put(
    'apps/web/step/step.ts',
    `import { outside } from '@app/flow'\nimport { salesperson } from '../role/role'\nexport const deliverProduct = outside(salesperson, 'deliverProduct')\nexport const shipProduct = outside(salesperson, 'deliverProduct')\n`,
  )
  put(
    'apps/web/flow/sales/salesCreation.ts',
    `import { defineFlow, operate, outside } from '@app/flow'\nimport { createSales } from '../../scenario/sales/createSales'\nimport { salesperson } from '../../role/role'\nimport { deliverProduct } from '../../step/step'\nexport const salesCreation = defineFlow('salesCreation', { steps: [deliverProduct, outside(salesperson, 'deliverProduct'), operate(createSales)] })\n`,
  )
  put(
    'apps/web/legacy/table.ts',
    `import { defineLegacyTable } from '@app/flow'\nexport const legacySales = defineLegacyTable('T_URIAGE', { title: '売上伝票', columns: [{ name: 'KINGAKU', title: '金額', replacement: 'sales.amount' }] })\n`,
  )
  put(
    'apps/web/legacy/sales/sales.ts',
    `import { defineLegacyFlow, operate, operateLegacy, outside } from '@app/flow'\nimport { salesCreation } from '../../flow/sales/salesCreation'\nimport { createSales } from '../../scenario/sales/createSales'\nimport { salesperson } from '../../role/role'\nimport { legacySales } from '../table'\nexport const sales = defineLegacyFlow('sales', {\n  replacement: salesCreation,\n  steps: [\n    outside(salesperson, 'deliverProduct'),\n    operate(createSales),\n    operateLegacy(salesperson, 'enterSales', { tables: [legacySales], replacement: 'createSales', operate: async (screen) => { if (screen) { await screen.press('登録') } } }),\n  ],\n})\n`,
  )
  put('apps/web/legacy/legacyInvoice.ts', `import { defineLegacyFlow, elapse } from '@app/flow'\nexport const legacyInvoice = defineLegacyFlow('legacyInvoice', { steps: [elapse('closingDate')] })\n`)

  put(
    'apps/web/estimate/estimate20261001.ts',
    `import { defineEstimate } from '@app/flow'\nimport { createSales } from '../scenario/sales/createSales'\nexport const estimateFirst = defineEstimate('2026-10-01', {\n  title: '見積',\n  items: [\n    { title: '売上の登録', amount: 300_000, targets: [createSales] },\n    { title: '金額がない' },\n    { title: '対象を文字で書いた', amount: 100_000, targets: ['createSales'] },\n  ],\n})\n`,
  )

  put('.claude/skills/review/SKILL.md', '---\nname: review\ndescription: レビューする\n---\n')
  put('apps/web/CLAUDE.md', '# 決まり\n')
  put('.cursorrules', '決まり\n')
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

  test('議事録: 変数の名前は meeting と日付、課題の名前は単語帳の言葉、期限は打合せの日以後、場所は import した値', () => {
    expect(rules('apps/web/meeting/meeting20261003.ts')).toEqual(['question-name', 'question-deadline', 'meeting-place'])
  })

  test('段の値: システムの外の業務は apps/web/step の値を使い、変数の名前は段の名前と同じ', () => {
    expect(rules('apps/web/step/step.ts')).toEqual(['step-name'])
    expect(rules('apps/web/flow/sales/salesCreation.ts')).toEqual(['step-place'])
  })

  test('現行の業務フロー: legacy で始まる名前・領域のフォルダ・変わらない段は同じ値・画面の操作は書かない・置き換え先は値で指す・旧システムの画面の手順は操作の並びだけ', () => {
    expect(rules('apps/web/legacy/sales/sales.ts')).toEqual(['legacy-name', 'legacy-step', 'legacy-step', 'legacy-step', 'legacy-step'])
    expect(rules('apps/web/legacy/legacyInvoice.ts')).toEqual(['legacy-place'])
    expect(rules('apps/web/legacy/table.ts')).toEqual(['legacy-table'])
  })

  test('見積: 変数の名前は estimate と日付、項目は名前と金額、対象は import した値', () => {
    expect(rules('apps/web/estimate/estimate20261001.ts')).toEqual(['estimate', 'estimate-item', 'estimate-item'])
    expect(model.estimates.map((estimate) => [estimate.id, estimate.totalAmount])).toEqual([['estimateFirst', 400_000]])
  })

  test('AI への指示: Skill は議事録を作る minutes の1つだけで、ほかに AI に向けた指示のファイルを置かない', () => {
    expect(rules('.claude/skills')).toEqual(['skill'])
    expect(rules('.claude/skills/minutes/SKILL.md')).toEqual(['skill'])
    expect(rules('apps/web/CLAUDE.md')).toEqual(['skill'])
    expect(rules('.cursorrules')).toEqual(['skill'])
  })

  test('議事録: 課題は、挙げた打合せより後の打合せで決めて、1回だけ解決する', () => {
    expect(rules('apps/web/meeting/meeting20261010.ts')).toEqual(['meeting', 'decision-question'])
    expect(model.questions.find((question) => question.key === 'salesKind')?.decision).toMatchObject({ meetingId: 'meetingSecond', text: '3つ' })
  })

  test('未着手のシナリオ・ケースは数える（問題にはしない）', () => {
    expect(model.progress).toMatchObject({ scenarios: 2, pendingScenarios: 1, cases: 2, pendingCases: 2 })
  })
})
