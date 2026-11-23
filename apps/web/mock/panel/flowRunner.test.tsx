// 開発パネル（pnpm dev:mock）が業務フローの段を画面で流す部品と、画面ごとのまとめを、画面の結合テストと同じ jsdom で確かめる。
import { listFlowPaths, type PathAction } from '@app/flow'
import { buildModel } from '@app/translator/model'
import { screen } from '@testing-library/react'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { paymentManagement } from '../../flow/payment/paymentManagement'
import { launchApp } from '../../test/launchApp'
import { composeMockModel } from '../mockModel'
import { describeCall, fillAction, openActionPage, prepareMockScreen, recordCalls, runAction, type OperateAction } from './flowRunner'
import { matchPage, summarizePages } from './pageSummary'

const mainActions = listFlowPaths(paymentManagement).find((path) => path.key === 'main')?.actions ?? []

function findOperate(number: string): OperateAction {
  const action = mainActions.find((candidate): candidate is OperateAction => candidate.kind === 'operate' && candidate.number === number)
  if (action === undefined) {
    throw new Error(`入金管理の段 ${number} がありません。`)
  }
  return action
}

describe('開発パネルの段の流し方', () => {
  test('段の操作を、画面に触らずに画面の言葉の文にする', async () => {
    const calls = await recordCalls(findOperate('2'))

    expect(calls.map(describeCall)).toEqual([
      '「入金登録」を開く',
      '入金日に「2026-11-20」を入れる',
      '入金額に「110000」を入れる',
      '振込依頼人名に「カ)オヤ」を入れる',
      '顧客で「株式会社親」を選ぶ',
      '「記録」を押す',
    ])
  })

  test('段を流すと、シナリオの操作と結果の確かめをする', async () => {
    const app = await launchApp(paymentManagement.precondition?.seed)
    const mockScreen = prepareMockScreen()

    for (const action of mainActions.slice(0, 2)) {
      expect(await runAction(action, mockScreen, async () => undefined)).toBeUndefined()
    }

    expect(app.database.payment).toHaveLength(1)
  })

  test('入れるだけなら、最後のボタン（記録）は押さずに残す', async () => {
    const app = await launchApp(paymentManagement.precondition?.seed)

    await fillAction(findOperate('2'), prepareMockScreen())

    expect(screen.getByLabelText('振込依頼人名')).toHaveValue('カ)オヤ')
    expect(app.database.payment).toEqual([])
  })

  test('ここまで進めたら、その段が最初に開く画面を開く', async () => {
    await launchApp(paymentManagement.precondition?.seed)

    await openActionPage(findOperate('2'), prepareMockScreen())

    expect(await screen.findByRole('heading', { name: '入金登録' })).toBeInTheDocument()
  })

  test('拡張の経路は、拡張の段を流してから本線の次の段へ戻る', () => {
    const unidentified = listFlowPaths(paymentManagement).find((path) => path.key === '2a')

    expect(unidentified?.actions.map((action: PathAction) => action.number)).toEqual(['1', '2a', '2a.1', '3'])
  })
})

describe('画面ごとのまとめ', () => {
  test('画面を開くシナリオ・使う業務フローをまとめる', () => {
    const model = composeMockModel(buildModel(join(dirname(fileURLToPath(import.meta.url)), '../../../..'), 'ja'))
    const summaries = summarizePages(model, ['/payments/new'])
    const paymentCreate = matchPage(summaries, '/payments/new')

    expect(paymentCreate?.page.title).toBe('入金登録')
    expect(paymentCreate?.scenarios.map((scenario) => scenario.id)).toContain('registerPayment')
    expect(paymentCreate?.flows.map((flow) => flow.id)).toContain('paymentManagement')
  }, 60_000)
})
