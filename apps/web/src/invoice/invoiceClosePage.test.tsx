// 請求の締めの画面の結合テスト。画面の操作から handler → usecase → domain → repository までを本物のコードで動かし、
// DB だけをモック DB にする。残高を繰り越す請求書の金額と、締めの規則を業務の場面ごとに確かめる。
import { prepareMemoryDatabase, type Adjustment, type Invoice, type MemoryDatabase, type Stored } from '@app/backend/testing'
import { prepareText, type MessageKey, type MessageParams } from '@app/vocabulary'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { customers, issuedOctoberInvoice, preparePayment, prepareSales } from '../../test/billingFixture'
import { renderScreen } from '../../test/renderScreen'
import { displayYen } from '../shared/yen'

const text = prepareText('ja')

/** 請求の締めの画面を開き、請求先と請求締め日を入れて締める。空の項目は触らない。 */
async function closeOnScreen(seed: Partial<MemoryDatabase>, billingCustomerId: string, closingDate: string) {
  const database = prepareMemoryDatabase({ customer: customers, ...seed })
  const { user } = await renderScreen('/invoices/close', database)
  if (billingCustomerId !== '') {
    await user.selectOptions(screen.getByLabelText(text.label('billingCustomer')), billingCustomerId)
  }
  if (closingDate !== '') {
    await user.type(screen.getByLabelText(text.label('closingDate')), closingDate)
  }
  await user.click(screen.getByRole('button', { name: text.label('close') }))
  return { database }
}

/** 締めたあとに開く請求の詳細の、請求の内訳の1つの金額。 */
async function readBreakdown(labelName: string): Promise<string | null | undefined> {
  const table = await screen.findByRole('table', { name: text.label('invoiceBreakdown') })
  const headers = within(table)
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  return within(table).getAllByRole('cell')[headers.indexOf(text.label(labelName))]?.textContent
}

/** 新しくできた請求の行（ID はテストの採番で id-0001）。 */
function findCreatedInvoice(database: MemoryDatabase): Stored<Invoice> | undefined {
  return database.invoice.find((row) => row.invoiceId === 'id-0001')
}

async function expectProblem(fieldName: string, messageKey: MessageKey, params: MessageParams = {}) {
  const fieldLabel = text.label(fieldName)
  const field = screen.getByLabelText(fieldLabel)
  await waitFor(() => {
    expect(field).toHaveAccessibleDescription(text.message(messageKey, { ...params, field: fieldLabel }))
  })
}

const transferFee: Stored<Adjustment> = {
  adjustmentId: 'adjustment-0001',
  billingCustomerId: 'customer-0001',
  adjustmentDate: '2026-11-25',
  adjustmentKind: 'transferFee',
  adjustmentAmount: 440,
  paymentId: 'payment-0002',
  invoiceId: null,
}

describe('請求の締めの画面', () => {
  test('初回の締め: 子会社の売上も請求先の親会社にまとめ、税率ごとに消費税を計算する。締め日より後の売上は載せない', async () => {
    const { database } = await closeOnScreen(
      {
        sales: [
          prepareSales('sales-0001', { customerId: 'customer-0002', salesDate: '2026-10-15', salesAmount: 100_000, taxRate: 10 }),
          prepareSales('sales-0002', { salesDate: '2026-10-20', salesAmount: 20_000, taxRate: 8 }),
          prepareSales('sales-0003', { salesDate: '2026-10-25', salesKind: 'return', salesAmount: -5000, taxRate: 8 }),
          prepareSales('sales-0004', { salesDate: '2026-11-01', salesAmount: 9999 }),
        ],
      },
      'customer-0001',
      '2026-10-31',
    )

    expect(await readBreakdown('currentInvoiceAmount')).toBe(displayYen('ja', 126_200))
    expect(findCreatedInvoice(database)).toEqual({
      invoiceId: 'id-0001',
      billingCustomerId: 'customer-0001',
      previousInvoiceId: null,
      closingDate: '2026-10-31',
      dueDate: '2026-11-30',
      previousAmount: 0,
      paymentAmount: 0,
      adjustmentAmount: 0,
      carriedAmount: 0,
      salesAmount: 115_000,
      taxAmount: 11_200,
      invoiceAmount: 126_200,
      invoiceNumber: null,
      issueDate: null,
    })
    expect(database.invoiceTax).toEqual([
      { invoiceId: 'id-0001', taxRate: 10, taxableAmount: 100_000, taxAmount: 10_000 },
      { invoiceId: 'id-0001', taxRate: 8, taxableAmount: 15_000, taxAmount: 1200 },
    ])
    expect(database.sales.map((row) => [row.salesId, row.invoiceId])).toEqual([
      ['sales-0001', 'id-0001'],
      ['sales-0002', 'id-0001'],
      ['sales-0003', 'id-0001'],
      ['sales-0004', null],
    ])
  })

  test('分割入金と振込手数料: 2回の入金と手数料の調整で、前回請求額を繰越 0 にする', async () => {
    const { database } = await closeOnScreen(
      {
        invoice: [issuedOctoberInvoice],
        payment: [
          preparePayment('payment-0001', { paymentDate: '2026-11-10', paymentAmount: 60_000 }),
          preparePayment('payment-0002', { paymentDate: '2026-11-25', paymentAmount: 65_760 }),
        ],
        adjustment: [transferFee],
        sales: [prepareSales('sales-0001', { salesDate: '2026-11-15', salesAmount: 10_000 })],
      },
      'customer-0001',
      '2026-11-30',
    )

    expect(await readBreakdown('carriedAmount')).toBe(displayYen('ja', 0))
    expect(findCreatedInvoice(database)).toMatchObject({
      previousInvoiceId: 'invoice-1001',
      dueDate: '2026-12-31',
      previousAmount: 126_200,
      paymentAmount: 125_760,
      adjustmentAmount: 440,
      carriedAmount: 0,
      salesAmount: 10_000,
      taxAmount: 1000,
      invoiceAmount: 11_000,
    })
    expect(database.payment.map((row) => row.invoiceId)).toEqual(['id-0001', 'id-0001'])
    expect(database.adjustment.map((row) => row.invoiceId)).toEqual(['id-0001'])
  })

  test('不足入金: 足りない分を繰越額として次の請求に載せる', async () => {
    const { database } = await closeOnScreen(
      {
        invoice: [issuedOctoberInvoice],
        payment: [preparePayment('payment-0001', { paymentAmount: 100_000 })],
      },
      'customer-0001',
      '2026-11-30',
    )

    expect(await readBreakdown('carriedAmount')).toBe(displayYen('ja', 26_200))
    expect(findCreatedInvoice(database)).toMatchObject({ carriedAmount: 26_200, invoiceAmount: 26_200 })
  })

  test('過入金: 多く受け取った分は負の繰越額（前受）として次へ繰り越す', async () => {
    const { database } = await closeOnScreen(
      {
        invoice: [issuedOctoberInvoice],
        payment: [preparePayment('payment-0001', { paymentDate: '2026-11-20', paymentAmount: 136_200 })],
      },
      'customer-0001',
      '2026-11-30',
    )

    expect(await readBreakdown('currentInvoiceAmount')).toBe(displayYen('ja', -10_000))
    expect(findCreatedInvoice(database)).toMatchObject({ paymentAmount: 136_200, carriedAmount: -10_000, invoiceAmount: -10_000 })
  })

  test('返金: 過入金を返金すると、今回入金額から差し引く', async () => {
    const { database } = await closeOnScreen(
      {
        invoice: [issuedOctoberInvoice],
        payment: [preparePayment('payment-0001', { paymentDate: '2026-11-20', paymentAmount: 136_200 })],
        refund: [{ refundId: 'refund-0001', paymentId: 'payment-0001', refundDate: '2026-11-25', refundAmount: 10_000, invoiceId: null }],
      },
      'customer-0001',
      '2026-11-30',
    )

    expect(await readBreakdown('currentPaymentAmount')).toBe(displayYen('ja', 126_200))
    expect(findCreatedInvoice(database)).toMatchObject({ paymentAmount: 126_200, carriedAmount: 0, invoiceAmount: 0 })
    expect(database.refund.map((row) => row.invoiceId)).toEqual(['id-0001'])
  })

  test('一括入金: 2か月分（10月の未入金を繰り越した11月の請求）を1回で入金すると、繰越 0 になる', async () => {
    const novemberInvoice: Stored<Invoice> = {
      ...issuedOctoberInvoice,
      invoiceId: 'invoice-1002',
      previousInvoiceId: 'invoice-1001',
      closingDate: '2026-11-30',
      dueDate: '2026-12-31',
      previousAmount: 126_200,
      carriedAmount: 126_200,
      salesAmount: 10_000,
      taxAmount: 1000,
      invoiceAmount: 137_200,
      invoiceNumber: '2026-000002',
      issueDate: '2026-12-01',
    }
    const { database } = await closeOnScreen(
      {
        invoice: [issuedOctoberInvoice, novemberInvoice],
        payment: [preparePayment('payment-0001', { paymentDate: '2026-12-20', paymentAmount: 137_200 })],
      },
      'customer-0001',
      '2026-12-31',
    )

    expect(await readBreakdown('previousInvoiceAmount')).toBe(displayYen('ja', 137_200))
    expect(findCreatedInvoice(database)).toMatchObject({
      previousInvoiceId: 'invoice-1002',
      previousAmount: 137_200,
      paymentAmount: 137_200,
      carriedAmount: 0,
      invoiceAmount: 0,
    })
  })

  test('振込人を特定できていない入金（仮受）は、請求に載せない', async () => {
    const { database } = await closeOnScreen(
      {
        sales: [prepareSales('sales-0001', { salesAmount: 10_000 })],
        payment: [preparePayment('payment-0001', { paymentDate: '2026-10-20', paymentAmount: 11_000, customerId: null, payerName: 'ヤマダ タロウ' })],
      },
      'customer-0001',
      '2026-10-31',
    )

    expect(await readBreakdown('currentPaymentAmount')).toBe(displayYen('ja', 0))
    expect(findCreatedInvoice(database)).toMatchObject({ paymentAmount: 0, invoiceAmount: 11_000 })
    expect(database.payment.map((row) => row.invoiceId)).toEqual([null])
  })

  test('締めた後に登録した、前回の締め日より前の日付の売上は、次の請求に載せる', async () => {
    const { database } = await closeOnScreen(
      {
        invoice: [issuedOctoberInvoice],
        sales: [prepareSales('sales-0001', { salesDate: '2026-10-28', salesAmount: 5000 })],
      },
      'customer-0001',
      '2026-11-30',
    )

    expect(await readBreakdown('currentSalesAmount')).toBe(displayYen('ja', 5000))
    expect(findCreatedInvoice(database)).toMatchObject({ carriedAmount: 126_200, salesAmount: 5000, taxAmount: 500, invoiceAmount: 131_700 })
  })

  describe('締日と入金期日', () => {
    test('20日締め翌月10日払いの請求先は、入金期日を翌月10日にする', async () => {
      const { database } = await closeOnScreen(
        { sales: [prepareSales('sales-0001', { customerId: 'customer-0003', salesDate: '2026-10-05' })] },
        'customer-0003',
        '2026-10-20',
      )

      await readBreakdown('currentInvoiceAmount')
      expect(findCreatedInvoice(database)).toMatchObject({ closingDate: '2026-10-20', dueDate: '2026-11-10' })
    })

    test('末締めは2月なら28日で締め、翌月末を入金期日にする', async () => {
      const { database } = await closeOnScreen(
        { sales: [prepareSales('sales-0001', { salesDate: '2027-02-10' })] },
        'customer-0001',
        '2027-02-28',
      )

      await readBreakdown('currentInvoiceAmount')
      expect(findCreatedInvoice(database)).toMatchObject({ closingDate: '2027-02-28', dueDate: '2027-03-31' })
    })

    test('20日締めの請求先を月末で締めようとすると止める', async () => {
      const { database } = await closeOnScreen(
        { sales: [prepareSales('sales-0001', { customerId: 'customer-0003' })] },
        'customer-0003',
        '2026-10-31',
      )

      await expectProblem('closingDate', 'closingDayRequired', { closingDay: 20 })
      expect(database.invoice).toEqual([])
    })

    test('末締めの請求先を月末以外で締めようとすると止める', async () => {
      await closeOnScreen({ sales: [prepareSales('sales-0001', {})] }, 'customer-0001', '2026-10-30')

      await expectProblem('closingDate', 'monthEndRequired')
    })
  })

  describe('前回の請求との関係', () => {
    test('前回の請求が未発行なら締めない', async () => {
      const { database } = await closeOnScreen(
        { invoice: [{ ...issuedOctoberInvoice, invoiceNumber: null, issueDate: null }] },
        'customer-0001',
        '2026-11-30',
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(text.message('unissuedInvoice'))
      expect(database.invoice).toHaveLength(1)
    })

    test('前回の締め日以前の日では締めない', async () => {
      await closeOnScreen({ invoice: [issuedOctoberInvoice], sales: [prepareSales('sales-0001', {})] }, 'customer-0001', '2026-10-31')

      await expectProblem('closingDate', 'earlyClosingDate', { previousDate: '2026-10-31' })
    })

    test('前回からの残高も、載せる行もなければ締めない', async () => {
      const { database } = await closeOnScreen({}, 'customer-0001', '2026-10-31')

      expect(await screen.findByRole('alert')).toHaveTextContent(text.message('emptyClosing'))
      expect(database.invoice).toEqual([])
    })
  })

  describe('入力', () => {
    test('子会社（請求先がほかの顧客）は請求先の選択肢に出さない', async () => {
      await renderScreen('/invoices/close', prepareMemoryDatabase({ customer: customers }))

      const options = within(screen.getByLabelText(text.label('billingCustomer'))).getAllByRole('option')
      expect(options.map((option) => option.textContent)).toEqual([
        text.message('selectionPrompt'),
        '株式会社親',
        '株式会社二十日',
      ])
    })

    test('請求先と請求締め日がなければ、まとめて止める', async () => {
      await closeOnScreen({}, '', '')

      await expectProblem('billingCustomer', 'selectionRequired')
      await expectProblem('closingDate', 'inputRequired')
    })

    test('実在しない日付は止める', async () => {
      await closeOnScreen({}, 'customer-0001', '2026-02-30')

      await expectProblem('closingDate', 'invalidDate')
    })
  })
})
