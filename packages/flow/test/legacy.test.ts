// 現行の業務フローの書き方を確かめる。変わる段だけが置き換え先を持ち、新しい業務フローには現行の段を書けない。
import { describe, expect, test } from 'vitest'
import { defineFlow, defineScenario, elapse, nest, occur, operate, outside } from '../src/definition'
import { defineLegacyFlow, defineLegacyTable, operateLegacy } from '../src/legacy'
import { defineRole } from '../src/role'

const accountant = defineRole('accountant', { side: 'business' })
const customer = defineRole('customer', { side: 'external' })
const sendInvoice = outside(accountant, 'sendInvoice')
const payInvoice = occur(customer, 'payInvoice')
const issueInvoice = defineScenario('issueInvoice', { actor: accountant })
const monthlyInvoice = defineFlow('monthlyInvoice', { steps: [operate(issueInvoice), sendInvoice, payInvoice] })
const legacyInvoice = defineLegacyTable('T_SEIKYU', { title: '請求', columns: [{ name: 'SEIKYU_NO', title: '請求番号', replacement: 'invoice.invoice_number' }] })

describe('現行の業務フロー', () => {
  test('変わらない段は新しい業務フローと同じ値を使い、変わる段は置き換え先を持つ', () => {
    const legacyMonthlyInvoice = defineLegacyFlow('legacyMonthlyInvoice', {
      replacement: monthlyInvoice,
      steps: [
        operateLegacy(accountant, 'printInvoice', { tables: [legacyInvoice], replacement: issueInvoice }),
        outside(accountant, 'mailInvoice', { replacement: sendInvoice }),
        outside(accountant, 'copyInvoice'),
        elapse('closingDate'),
        payInvoice,
      ],
    })

    expect(legacyMonthlyInvoice.replacement).toEqual([monthlyInvoice])
    expect(legacyMonthlyInvoice.steps[0]).toMatchObject({ kind: 'legacy', tables: [legacyInvoice], replacement: [issueInvoice] })
    expect(legacyMonthlyInvoice.steps[1]).toMatchObject({ kind: 'outside', replacement: [sendInvoice] })
    expect(legacyMonthlyInvoice.steps[3]).toEqual({ kind: 'elapse', time: 'closingDate', date: undefined })
    expect(legacyMonthlyInvoice.steps[4]).toBe(monthlyInvoice.steps[2])
    expect(nest(legacyMonthlyInvoice)).toEqual({ kind: 'nest', flow: legacyMonthlyInvoice })
  })

  test('新しい業務フローには、現行の段（旧システムの操作・置き換え先・日付のない時の経過・画面の操作）を書けない', () => {
    // @ts-expect-error 旧システムの操作は、新しい業務フローの段にならない
    defineFlow('wrongFlow', { steps: [operateLegacy(accountant, 'printInvoice')] })
    // @ts-expect-error 置き換え先は、現行の業務フローの段にだけ書く
    defineFlow('wrongFlow', { steps: [outside(accountant, 'mailInvoice', { replacement: sendInvoice })] })
    // @ts-expect-error 新しい業務フローの時の経過には、テストの日付が要る
    defineFlow('wrongFlow', { steps: [elapse('closingDate')] })
    // @ts-expect-error 現行の業務フローに、画面の操作は書けない
    defineLegacyFlow('legacyWrongFlow', { steps: [operate(issueInvoice)] })
    expect(true).toBe(true)
  })
})
