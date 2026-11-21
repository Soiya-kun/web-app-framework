// 見積の書き方を確かめる。項目の名前と金額が最小で、対象は書かなくてもよい。
import { describe, expect, test } from 'vitest'
import { defineFlow } from '../src/definition'
import { defineEstimate } from '../src/estimate'

describe('見積', () => {
  test('項目の名前と金額を持ち、対象は値で指す（書かなくてもよい）', () => {
    const monthlyInvoice = defineFlow('monthlyInvoice', { steps: [] })
    const estimate20261031 = defineEstimate('2026-10-31', {
      title: '見積',
      items: [
        { title: '要件定義', amount: 1_000_000 },
        { title: '月次の請求', amount: 2_000_000, targets: [monthlyInvoice] },
      ],
    })

    expect(estimate20261031).toEqual({
      kind: 'estimate',
      date: '2026-10-31',
      title: '見積',
      items: [
        { title: '要件定義', amount: 1_000_000 },
        { title: '月次の請求', amount: 2_000_000, targets: [monthlyInvoice] },
      ],
    })
  })
})
