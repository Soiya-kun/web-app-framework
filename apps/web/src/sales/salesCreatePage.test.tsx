// 売上登録の画面の結合テスト。画面の操作から handler → usecase → domain → repository までを本物のコードで動かし、
// DB だけをモック DB にする。境界値はここで確かめる。
import type { SalesRequest } from '@app/backend'
import { prepareMemoryDatabase } from '@app/backend/testing'
import { prepareText, type MessageKey, type MessageParams } from '@app/vocabulary'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { renderScreen } from '../../test/renderScreen'

const text = prepareText('ja')
const sampleCustomer = { customerId: 'customer-0001', customerName: '株式会社サンプル' }
const validRequest: SalesRequest = { customerId: 'customer-0001', salesDate: '2026-11-18', salesAmount: '1000' }

/** 売上登録の画面を開き、値を入れて登録ボタンを押す。 */
async function submitSalesForm(salesRequest: SalesRequest) {
  const database = prepareMemoryDatabase({ customer: [sampleCustomer] })
  const { user } = await renderScreen('/sales/new', database)
  const customerField = await screen.findByLabelText(text.label('customer'))
  if (salesRequest.customerId !== '') {
    await user.selectOptions(customerField, salesRequest.customerId)
  }
  if (salesRequest.salesDate !== '') {
    await user.type(screen.getByLabelText(text.label('salesDate')), salesRequest.salesDate)
  }
  if (salesRequest.salesAmount !== '') {
    await user.type(screen.getByLabelText(text.label('salesAmount')), salesRequest.salesAmount)
  }
  await user.click(screen.getByRole('button', { name: text.label('create') }))
  return { database }
}

/** 項目の下に、その項目の問題の文が出ていること。 */
async function expectIssue(fieldName: string, messageKey: MessageKey, params: MessageParams = {}) {
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
      { salesId: 'id-0001', customerId: 'customer-0001', salesDate: '2026-11-18', salesAmount: 1000 },
    ])
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

      await expectIssue('salesAmount', messageKey, { minimum: 1, maximum: 999_999_999 })
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

      await expectIssue('salesDate', messageKey)
      expect(database.sales).toEqual([])
    })
  })

  test('顧客を選ばなければ止める', async () => {
    const { database } = await submitSalesForm({ ...validRequest, customerId: '' })

    await expectIssue('customer', 'selectionRequired')
    expect(database.sales).toEqual([])
  })

  test('問題のある項目をまとめて表示する', async () => {
    await submitSalesForm({ customerId: '', salesDate: '', salesAmount: '' })

    await expectIssue('customer', 'selectionRequired')
    await expectIssue('salesDate', 'inputRequired')
    await expectIssue('salesAmount', 'inputRequired')
  })
})
