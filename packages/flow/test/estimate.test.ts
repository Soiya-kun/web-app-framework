// 見積の書き方を確かめる。項目の名前と金額が最小で、対象は書かなくてもよい。
import { describe, expect, test } from 'vitest'
import { defineFlow } from '../src/definition'
import { defineEffort } from '../src/effort'
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
      rate: undefined,
      items: [
        { title: '要件定義', amount: 1_000_000 },
        { title: '月次の請求', amount: 2_000_000, targets: [monthlyInvoice] },
      ],
    })
  })

  test('機能ごとの工数は、監査の人日と、人がコーディングとテストをする場合の人日を持つ。見積には人日単価を書ける', () => {
    const monthlyInvoice = defineFlow('monthlyInvoice', { steps: [] })
    const effort = defineEffort([{ target: monthlyInvoice, audit: 1, manual: 5 }])
    const estimate20261031 = defineEstimate('2026-10-31', { title: '見積', rate: 80_000, items: [] })

    expect(effort).toEqual({ kind: 'effort', items: [{ target: monthlyInvoice, audit: 1, manual: 5 }] })
    expect(estimate20261031.rate).toBe(80_000)
  })
})
