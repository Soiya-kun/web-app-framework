// 売上を登録するシナリオのケース。画面の操作から handler → usecase → domain → repository までを本物のコードで動かし、
// DB だけをモック DB にする。境界値はここで確かめる。
import { confirmScenario, operateScenario } from '@app/flow'
import { describeScenario } from '@app/flow/vitest'
import type { Customer, Stored } from '@app/backend/testing'
import { expect } from 'vitest'
import { launchApp } from '../../test/launchApp'
import { createSales, type SalesInput } from './createSales'

const sampleCustomer: Stored<Customer> = {
  customerId: 'customer-0001',
  customerName: '株式会社サンプル',
  billingCustomerId: 'customer-0001',
  closingDay: 31,
  collectionMonthOffset: 1,
  collectionDay: 31,
}

const validSales: SalesInput = {
  customer: '株式会社サンプル',
  salesDate: '2026-11-18',
  salesKind: '通常',
  itemName: '運賃',
  salesAmount: '1000',
  taxRate: '10%',
}

/** 画面を開いて売上を登録する（確かめるのはケースごと）。 */
async function createOnScreen(sales: SalesInput) {
  const app = await launchApp({ customer: [sampleCustomer] })
  await operateScenario(createSales, app.screen, sales)
  return app
}

describeScenario(createSales, (cases) => {
  cases.main('入力した売上を保存し、登録したことを表示する', async () => {
    const app = await createOnScreen(validSales)

    await confirmScenario(createSales, app.screen, validSales)
    expect(app.database.sales).toEqual([
      {
        salesId: 'id-0001',
        customerId: 'customer-0001',
        salesDate: '2026-11-18',
        salesKind: 'normal',
        itemName: '運賃',
        salesAmount: 1000,
        taxRate: 10,
        invoiceId: null,
      },
    ])
  })

  cases.varyEach(
    [
      { salesKind: '返品', savedKind: 'return' },
      { salesKind: '値引', savedKind: 'discount' },
    ],
    '$salesKind は金額を正で入力し、負の金額で保存する',
    async ({ salesKind, savedKind }) => {
      const app = await createOnScreen({ ...validSales, salesKind })

      await confirmScenario(createSales, app.screen, validSales)
      expect(app.database.sales.map((row) => [row.salesKind, row.salesAmount])).toEqual([[savedKind, -1000]])
    },
  )

  cases.vary('軽減税率を選べる', async () => {
    const app = await createOnScreen({ ...validSales, taxRate: '8%（軽減）' })

    await confirmScenario(createSales, app.screen, validSales)
    expect(app.database.sales.map((row) => row.taxRate)).toEqual([8])
  })

  cases.varyEach(
    [
      { salesAmount: '1', savedAmount: 1 },
      { salesAmount: '999999999', savedAmount: 999_999_999 },
      { salesAmount: ' 100 ', savedAmount: 100 },
    ],
    '売上金額「$salesAmount」は保存する',
    async ({ salesAmount, savedAmount }) => {
      const app = await createOnScreen({ ...validSales, salesAmount })

      await confirmScenario(createSales, app.screen, validSales)
      expect(app.database.sales.map((row) => row.salesAmount)).toEqual([savedAmount])
    },
  )

  cases.vary('うるう年の 2月29日は保存する', async () => {
    const app = await createOnScreen({ ...validSales, salesDate: '2028-02-29' })

    await confirmScenario(createSales, app.screen, validSales)
    expect(app.database.sales.map((row) => row.salesDate)).toEqual(['2028-02-29'])
  })

  cases.vary('品名の 100 文字は保存する', async () => {
    const app = await createOnScreen({ ...validSales, itemName: 'あ'.repeat(100) })

    await confirmScenario(createSales, app.screen, validSales)
    expect(app.database.sales.map((row) => row.itemName.length)).toEqual([100])
  })

  cases.extend('unselectedCustomer', '顧客の項目に「選んでください」と出し、保存しない', async () => {
    const app = await createOnScreen({ ...validSales, customer: '' })

    await app.screen.expectProblem('customer', 'selectionRequired')
    expect(app.database.sales).toEqual([])
  })

  cases.extendEach(
    'invalidSalesAmount',
    [
      { salesAmount: '0', messageKey: 'invalidRange' },
      { salesAmount: '1000000000', messageKey: 'invalidRange' },
      { salesAmount: '-1', messageKey: 'integerRequired' },
      { salesAmount: '1.5', messageKey: 'integerRequired' },
      { salesAmount: '1,000', messageKey: 'integerRequired' },
      { salesAmount: 'abc', messageKey: 'integerRequired' },
      { salesAmount: '', messageKey: 'inputRequired' },
    ] as const,
    '売上金額「$salesAmount」は「$messageKey」で止める',
    async ({ salesAmount, messageKey }) => {
      const app = await createOnScreen({ ...validSales, salesAmount })

      await app.screen.expectProblem('salesAmount', messageKey, { minimum: 1, maximum: 999_999_999 })
      expect(app.database.sales).toEqual([])
    },
  )

  cases.extendEach(
    'invalidSalesDate',
    [
      { salesDate: '2026-02-29', messageKey: 'invalidDate' },
      { salesDate: '2026-13-01', messageKey: 'invalidDate' },
      { salesDate: '2026-1-1', messageKey: 'invalidDate' },
      { salesDate: '', messageKey: 'inputRequired' },
    ] as const,
    '売上日「$salesDate」は「$messageKey」で止める',
    async ({ salesDate, messageKey }) => {
      const app = await createOnScreen({ ...validSales, salesDate })

      await app.screen.expectProblem('salesDate', messageKey)
      expect(app.database.sales).toEqual([])
    },
  )

  cases.extendEach(
    'invalidItemName',
    [
      { itemName: 'あ'.repeat(101), messageKey: 'longText' },
      { itemName: '   ', messageKey: 'inputRequired' },
      { itemName: '', messageKey: 'inputRequired' },
    ] as const,
    '品名「$itemName」は「$messageKey」で止める',
    async ({ itemName, messageKey }) => {
      const app = await createOnScreen({ ...validSales, itemName })

      await app.screen.expectProblem('itemName', messageKey, { maximum: 100 })
      expect(app.database.sales).toEqual([])
    },
  )

  cases.extend('invalidFields', '問題のある項目をまとめて表示する', async () => {
    const app = await createOnScreen({ ...validSales, customer: '', salesDate: '', itemName: '', salesAmount: '' })

    await app.screen.expectProblem('customer', 'selectionRequired')
    await app.screen.expectProblem('salesDate', 'inputRequired')
    await app.screen.expectProblem('itemName', 'inputRequired')
    await app.screen.expectProblem('salesAmount', 'inputRequired')
  })
})
