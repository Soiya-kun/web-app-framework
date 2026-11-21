// 業務フローを経路に展開する規則（番号の振り方・拡張の経路・本線へ戻るかどうか）を確かめる。
import { describe, expect, test } from 'vitest'
import { defineFlow, defineScenario, elapse, nest, occur, operate, outside } from '../src/definition'
import { listFlowPaths, runFlowPath } from '../src/path'
import { defineRole } from '../src/role'
import type { Screen } from '../src/screen'

const accountant = defineRole('accountant', { side: 'business' })
const salesperson = defineRole('salesperson', { side: 'business' })
const customer = defineRole('customer', { side: 'external' })

const calls: string[] = []
const record = (name: string) => async (_screen: Screen, input: string) => {
  calls.push(`${name}:${input}`)
}

const registerPayment = defineScenario('registerPayment', {
  actor: accountant,
  operate: record('registerPayment'),
  confirm: record('confirm'),
  extensions: { unidentifiedPayer: { condition: '振込依頼人名から顧客を特定できない', confirm: record('unidentified') } },
})
const identifyPayment = defineScenario('identifyPayment', { actor: accountant, operate: record('identifyPayment') })
const browsePayments = defineScenario('browsePayments', { actor: accountant })

const child = defineFlow('paymentManagement', {
  steps: [
    occur(customer, 'payInvoice'),
    operate(registerPayment, 'main', { unidentifiedPayer: { input: 'unknown', then: [operate(identifyPayment, 'later')] } }),
  ],
})
const parent = defineFlow('monthlyInvoice', {
  steps: [outside(salesperson, 'deliverProduct'), elapse('closingDate', '2026-10-31'), nest(child), operate(browsePayments)],
})

describe('listFlowPaths', () => {
  test('子フローの段は「親の番号.子の番号」、拡張は「番号＋a」にする', () => {
    expect(listFlowPaths(parent).map((path) => [path.key, path.title, path.actions.map((action) => action.number)])).toEqual([
      ['main', '本線', ['1', '2', '3.1', '3.2', '4']],
      ['3.2a', '3.2a. 振込依頼人名から顧客を特定できない', ['1', '2', '3.1', '3.2a', '3.2a.1', '4']],
    ])
  })

  test('resume: false の拡張は、拡張の段のあと経路を終える', () => {
    const flow = defineFlow('monthlyInvoice', {
      steps: [operate(registerPayment, 'main', { unidentifiedPayer: { input: 'unknown', resume: false } }), operate(browsePayments)],
    })

    expect(listFlowPaths(flow).map((path) => path.actions.map((action) => action.number))).toEqual([['1', '2'], ['1a']])
  })
})

describe('runFlowPath', () => {
  test('拡張の経路では、その段の扱い（拡張の confirm）を確かめ、未着手のシナリオで止める', async () => {
    calls.length = 0
    const days: string[] = []
    const [, extensionPath] = listFlowPaths(parent)

    const result = await runFlowPath(extensionPath!, {} as Screen, async (date) => {
      days.push(date)
    })

    expect(calls).toEqual(['registerPayment:unknown', 'unidentified:unknown', 'identifyPayment:later'])
    expect(days).toEqual(['2026-10-31'])
    expect(result).toEqual({ pendingAt: '4. browsePayments' })
  })
})
