// 入金の画面の結合テスト。記録・振込依頼人名による顧客の特定・仮受・仮受の特定と、締めへのつながりを確かめる。
import { prepareMemoryDatabase, type MemoryDatabase } from '@app/backend/testing'
import { prepareText, type LabelKey, type MessageKey, type MessageParams } from '@app/vocabulary/text'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { customers, issuedOctoberInvoice, preparePayment } from '../../test/billingFixture'
import { renderScreen } from '../../test/renderScreen'
import { displayYen } from '../shared/yen'

const text = prepareText('ja')

type PaymentValues = {
  readonly paymentDate: string
  readonly paymentAmount: string
  readonly payerName: string
  readonly customerId: string
}

const validValues: PaymentValues = { paymentDate: '2026-11-10', paymentAmount: '50000', payerName: 'ｶ)ｵﾔ', customerId: '' }

/** 入金の記録の画面を開き、値を入れて記録する。空の項目は触らない。 */
async function registerOnScreen(seed: Partial<MemoryDatabase>, values: PaymentValues) {
  const database = prepareMemoryDatabase({ customer: customers, ...seed })
  const { user } = await renderScreen('/payments/new', database)
  if (values.paymentDate !== '') {
    await user.type(screen.getByLabelText(text.label('paymentDate')), values.paymentDate)
  }
  if (values.paymentAmount !== '') {
    await user.type(screen.getByLabelText(text.label('paymentAmount')), values.paymentAmount)
  }
  if (values.payerName !== '') {
    await user.type(screen.getByLabelText(text.label('payerName')), values.payerName)
  }
  if (values.customerId !== '') {
    await user.selectOptions(screen.getByLabelText(text.label('customer')), values.customerId)
  }
  await user.click(screen.getByRole('button', { name: text.action('register') }))
  return { database, user }
}

async function expectProblem(fieldName: LabelKey, messageKey: MessageKey, params: MessageParams = {}) {
  const fieldLabel = text.label(fieldName)
  const field = screen.getByLabelText(fieldLabel)
  await waitFor(() => {
    expect(field).toHaveAccessibleDescription(text.message(messageKey, { ...params, field: fieldLabel }))
  })
}

describe('入金の記録の画面', () => {
  test('顧客を選んで記録すると、その顧客の入金にし、振込依頼人名を半角・全角の違いをそろえて覚える', async () => {
    const { database } = await registerOnScreen({}, { ...validValues, customerId: 'customer-0001' })

    expect(await screen.findByRole('status')).toHaveTextContent(text.message('paymentIdentified', { customer: '株式会社親' }))
    expect(database.payment).toEqual([
      {
        paymentId: 'id-0001',
        paymentDate: '2026-11-10',
        paymentMethod: 'transfer',
        paymentAmount: 50_000,
        payerName: 'カ)オヤ',
        customerId: 'customer-0001',
        invoiceId: null,
      },
    ])
    expect(database.payerName).toEqual([{ payerName: 'カ)オヤ', customerId: 'customer-0001' }])
  })

  test('顧客を選ばなければ、覚えた振込依頼人名から顧客を特定する', async () => {
    const { database } = await registerOnScreen(
      { payerName: [{ payerName: 'カ)オヤ', customerId: 'customer-0001' }] },
      { ...validValues, payerName: 'カ）オヤ' },
    )

    expect(await screen.findByRole('status')).toHaveTextContent(text.message('paymentIdentified', { customer: '株式会社親' }))
    expect(database.payment.map((row) => row.customerId)).toEqual(['customer-0001'])
  })

  test('特定できなければ仮受として記録し、振込依頼人名は覚えない', async () => {
    const { database } = await registerOnScreen({}, { ...validValues, payerName: 'ヤマダ　　タロウ' })

    expect(await screen.findByRole('status')).toHaveTextContent(text.message('unidentifiedPayment'))
    expect(database.payment.map((row) => [row.payerName, row.customerId])).toEqual([['ヤマダ タロウ', null]])
    expect(database.payerName).toEqual([])
  })

  describe('入力の境界', () => {
    test.each([
      { paymentAmount: '1', savedAmount: 1 },
      { paymentAmount: '999999999', savedAmount: 999_999_999 },
    ])('入金額 $paymentAmount は記録する', async ({ paymentAmount, savedAmount }) => {
      const { database } = await registerOnScreen({}, { ...validValues, paymentAmount })

      expect(await screen.findByRole('status')).toBeVisible()
      expect(database.payment.map((row) => row.paymentAmount)).toEqual([savedAmount])
    })

    test.each([
      { paymentAmount: '0', messageKey: 'invalidRange' },
      { paymentAmount: '1000000000', messageKey: 'invalidRange' },
      { paymentAmount: 'abc', messageKey: 'integerRequired' },
      { paymentAmount: '', messageKey: 'inputRequired' },
    ] as const)('入金額 $paymentAmount は「$messageKey」で止める', async ({ paymentAmount, messageKey }) => {
      const { database } = await registerOnScreen({}, { ...validValues, paymentAmount })

      await expectProblem('paymentAmount', messageKey, { minimum: 1, maximum: 999_999_999 })
      expect(database.payment).toEqual([])
    })

    test.each([
      { payerName: 'ア'.repeat(101), messageKey: 'longText' },
      { payerName: '', messageKey: 'inputRequired' },
    ] as const)('振込依頼人名「$payerName」は「$messageKey」で止める', async ({ payerName, messageKey }) => {
      await registerOnScreen({}, { ...validValues, payerName })

      await expectProblem('payerName', messageKey, { maximum: 100 })
    })

    test('実在しない入金日は止める', async () => {
      await registerOnScreen({}, { ...validValues, paymentDate: '2026-11-31' })

      await expectProblem('paymentDate', 'invalidDate')
    })
  })
})

describe('入金の一覧の画面', () => {
  test('仮受の入金の行で顧客を選んで特定すると、顧客を入れて振込依頼人名を覚える', async () => {
    const database = prepareMemoryDatabase({
      customer: customers,
      payment: [preparePayment('payment-0001', { customerId: null, payerName: 'ヤマダ タロウ' })],
    })
    const { user } = await renderScreen('/payments', database)
    const row = screen.getByRole('row', { name: /ヤマダ タロウ/ })

    await user.selectOptions(within(row).getByLabelText(text.label('customer')), 'customer-0001')
    await user.click(within(row).getByRole('button', { name: text.action('identify') }))

    expect(await screen.findByRole('status')).toHaveTextContent(text.message('identifyCompleted'))
    expect(await within(row).findByText('株式会社親')).toBeVisible()
    expect(database.payment.map((payment) => payment.customerId)).toEqual(['customer-0001'])
    expect(database.payerName).toEqual([{ payerName: 'ヤマダ タロウ', customerId: 'customer-0001' }])
  })

  test('請求に載せたかどうかを出す', async () => {
    await renderScreen(
      '/payments',
      prepareMemoryDatabase({
        customer: customers,
        invoice: [issuedOctoberInvoice],
        payment: [
          preparePayment('payment-0001', { paymentDate: '2026-10-20', invoiceId: 'invoice-1001' }),
          preparePayment('payment-0002', { paymentDate: '2026-11-10' }),
        ],
      }),
    )

    const rows = within(screen.getByRole('table', { name: text.label('paymentList') })).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell').at(-1)?.textContent)).toEqual([
      text.label('unbilled'),
      text.label('billed'),
    ])
  })
})

test('記録した入金は、次の締めで今回入金額に載る（入金の記録 → 請求の締め）', async () => {
  const { database, user } = await registerOnScreen(
    { invoice: [issuedOctoberInvoice] },
    { paymentDate: '2026-11-20', paymentAmount: '126200', payerName: 'カ)オヤ', customerId: 'customer-0001' },
  )
  await screen.findByRole('status')

  await user.click(screen.getByRole('link', { name: text.label('invoiceClosing') }))
  await user.selectOptions(await screen.findByLabelText(text.label('billingCustomer')), 'customer-0001')
  await user.type(screen.getByLabelText(text.label('closingDate')), '2026-11-30')
  await user.click(screen.getByRole('button', { name: text.action('close') }))

  const table = await screen.findByRole('table', { name: text.label('invoiceBreakdown') })
  expect(within(table).getAllByRole('cell').map((cell) => cell.textContent).slice(0, 4)).toEqual(
    [126_200, 126_200, 0, 0].map((amount) => displayYen('ja', amount)),
  )
  expect(database.payment.map((payment) => payment.invoiceId)).toEqual(['id-0002'])
})
