// 売上登録の画面の結合テスト。画面の操作から handler → usecase → domain → repository までを本物のコードで動かし、
// DB だけをモック DB にする。境界値はここで確かめる。
import type { SalesRequest } from '@app/backend'
import { prepareMemoryDatabase, type Customer, type Stored } from '@app/backend/testing'
import { prepareText, type LabelKey, type MessageKey, type MessageParams } from '@app/vocabulary/text'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { renderScreen } from '../../test/renderScreen'

const text = prepareText('ja')

const sampleCustomer: Stored<Customer> = {
  customerId: 'customer-0001',
  customerName: '株式会社サンプル',
  billingCustomerId: 'customer-0001',
  closingDay: 31,
  collectionMonthOffset: 1,
  collectionDay: 31,
}

const validRequest: SalesRequest = {
  customerId: 'customer-0001',
  salesDate: '2026-11-18',
  salesKind: 'normal',
  itemName: '運賃',
  salesAmount: '1000',
  taxRate: '10',
}

/** 売上登録の画面を開き、値を入れて登録ボタンを押す。空の項目は触らない。 */
async function submitSalesForm(salesRequest: SalesRequest) {
  const database = prepareMemoryDatabase({ customer: [sampleCustomer] })
  const { user } = await renderScreen('/sales/new', database)
  if (salesRequest.customerId !== '') {
    await user.selectOptions(screen.getByLabelText(text.label('customer')), salesRequest.customerId)
  }
  if (salesRequest.salesDate !== '') {
    await user.type(screen.getByLabelText(text.label('salesDate')), salesRequest.salesDate)
  }
  await user.selectOptions(screen.getByLabelText(text.label('salesKind')), salesRequest.salesKind)
  if (salesRequest.itemName !== '') {
    await user.type(screen.getByLabelText(text.label('itemName')), salesRequest.itemName)
  }
  if (salesRequest.salesAmount !== '') {
    await user.type(screen.getByLabelText(text.label('salesAmount')), salesRequest.salesAmount)
  }
  await user.selectOptions(screen.getByLabelText(text.label('taxRate')), salesRequest.taxRate)
  await user.click(screen.getByRole('button', { name: text.action('create') }))
  return { database }
}

/** 項目の下に、その項目の問題の文が出ていること。 */
async function expectProblem(fieldName: LabelKey, messageKey: MessageKey, params: MessageParams = {}) {
  const fieldLabel = text.label(fieldName)
  const field = screen.getByLabelText(fieldLabel)
  await waitFor(() => {
    expect(field).toHaveAccessibleDescription(text.message(messageKey, { ...params, field: fieldLabel }))
  })
  expect(field).toHaveAttribute('aria-invalid', 'true')
}

describe('売上登録の画面', () => {
  test('入力した売上を保存し、登録したことを表示する', async () => {
    const { database } = await submitSalesForm(validRequest)

    expect(await screen.findByRole('status')).toHaveTextContent(text.message('createCompleted'))
    expect(database.sales).toEqual([
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

  test.each(['return', 'discount'])('%s は金額を正で入力し、負の金額で保存する', async (salesKind) => {
    const { database } = await submitSalesForm({ ...validRequest, salesKind })

    expect(await screen.findByRole('status')).toBeVisible()
    expect(database.sales.map((row) => [row.salesKind, row.salesAmount])).toEqual([[salesKind, -1000]])
  })

  test('軽減税率を選べる', async () => {
    const { database } = await submitSalesForm({ ...validRequest, taxRate: '8' })

    expect(await screen.findByRole('status')).toBeVisible()
    expect(database.sales.map((row) => row.taxRate)).toEqual([8])
  })

  describe('売上金額の境界', () => {
    test.each([
      { salesAmount: '1', savedAmount: 1 },
      { salesAmount: '999999999', savedAmount: 999_999_999 },
      { salesAmount: ' 100 ', savedAmount: 100 },
    ])('$salesAmount は保存する', async ({ salesAmount, savedAmount }) => {
      const { database } = await submitSalesForm({ ...validRequest, salesAmount })

      expect(await screen.findByRole('status')).toBeVisible()
      expect(database.sales.map((row) => row.salesAmount)).toEqual([savedAmount])
    })

    test.each([
      { salesAmount: '0', messageKey: 'invalidRange' },
      { salesAmount: '1000000000', messageKey: 'invalidRange' },
      { salesAmount: '-1', messageKey: 'integerRequired' },
      { salesAmount: '1.5', messageKey: 'integerRequired' },
      { salesAmount: '1,000', messageKey: 'integerRequired' },
      { salesAmount: 'abc', messageKey: 'integerRequired' },
      { salesAmount: '', messageKey: 'inputRequired' },
    ] as const)('$salesAmount は「$messageKey」で止める', async ({ salesAmount, messageKey }) => {
      const { database } = await submitSalesForm({ ...validRequest, salesAmount })

      await expectProblem('salesAmount', messageKey, { minimum: 1, maximum: 999_999_999 })
      expect(database.sales).toEqual([])
    })
  })

  describe('売上日の境界', () => {
    test('うるう年の 2月29日は保存する', async () => {
      const { database } = await submitSalesForm({ ...validRequest, salesDate: '2028-02-29' })

      expect(await screen.findByRole('status')).toBeVisible()
      expect(database.sales.map((row) => row.salesDate)).toEqual(['2028-02-29'])
    })

    test.each([
      { salesDate: '2026-02-29', messageKey: 'invalidDate' },
      { salesDate: '2026-13-01', messageKey: 'invalidDate' },
      { salesDate: '2026-1-1', messageKey: 'invalidDate' },
      { salesDate: '', messageKey: 'inputRequired' },
    ] as const)('$salesDate は「$messageKey」で止める', async ({ salesDate, messageKey }) => {
      const { database } = await submitSalesForm({ ...validRequest, salesDate })

      await expectProblem('salesDate', messageKey)
      expect(database.sales).toEqual([])
    })
  })

  describe('品名の境界', () => {
    test('100文字は保存する', async () => {
      const { database } = await submitSalesForm({ ...validRequest, itemName: 'あ'.repeat(100) })

      expect(await screen.findByRole('status')).toBeVisible()
      expect(database.sales.map((row) => row.itemName.length)).toEqual([100])
    })

    test.each([
      { itemName: 'あ'.repeat(101), messageKey: 'longText' },
      { itemName: '   ', messageKey: 'inputRequired' },
      { itemName: '', messageKey: 'inputRequired' },
    ] as const)('「$itemName」は「$messageKey」で止める', async ({ itemName, messageKey }) => {
      const { database } = await submitSalesForm({ ...validRequest, itemName })

      await expectProblem('itemName', messageKey, { maximum: 100 })
      expect(database.sales).toEqual([])
    })
  })

  test('顧客を選ばなければ止める', async () => {
    const { database } = await submitSalesForm({ ...validRequest, customerId: '' })

    await expectProblem('customer', 'selectionRequired')
    expect(database.sales).toEqual([])
  })

  test('問題のある項目をまとめて表示する', async () => {
    await submitSalesForm({ ...validRequest, customerId: '', salesDate: '', itemName: '', salesAmount: '' })

    await expectProblem('customer', 'selectionRequired')
    await expectProblem('salesDate', 'inputRequired')
    await expectProblem('itemName', 'inputRequired')
    await expectProblem('salesAmount', 'inputRequired')
  })
})
