// 請求の詳細の画面の結合テスト。請求書の表示と、発行（請求番号の採番）・締めの取消を、画面の操作から確かめる。
import {
  prepareMemoryDatabase,
  type Adjustment,
  type Invoice,
  type InvoiceTax,
  type MemoryDatabase,
  type Refund,
  type Stored,
} from '@app/backend/testing'
import { prepareText, type MessageKey, type MessageParams } from '@app/vocabulary'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { customers, issuedOctoberInvoice, preparePayment, prepareSales } from '../../test/billingFixture'
import { renderScreen } from '../../test/renderScreen'
import { displayYen } from '../shared/yen'

const text = prepareText('ja')

/** 発行前の10月の請求。子会社の売上・入金・返金・振込手数料を載せている。 */
const draftInvoice: Stored<Invoice> = {
  invoiceId: 'invoice-2001',
  billingCustomerId: 'customer-0001',
  previousInvoiceId: null,
  closingDate: '2026-10-31',
  dueDate: '2026-11-30',
  previousAmount: 0,
  paymentAmount: 49_000,
  adjustmentAmount: 440,
  carriedAmount: -49_440,
  salesAmount: 100_000,
  taxAmount: 10_000,
  invoiceAmount: 60_560,
  invoiceNumber: null,
  issueDate: null,
}

const draftTax: Stored<InvoiceTax> = { invoiceId: 'invoice-2001', taxRate: 10, taxableAmount: 100_000, taxAmount: 10_000 }

const draftRefund: Stored<Refund> = {
  refundId: 'refund-0001',
  paymentId: 'payment-0001',
  refundDate: '2026-10-28',
  refundAmount: 1000,
  invoiceId: 'invoice-2001',
}

const draftAdjustment: Stored<Adjustment> = {
  adjustmentId: 'adjustment-0001',
  billingCustomerId: 'customer-0001',
  adjustmentDate: '2026-10-25',
  adjustmentKind: 'transferFee',
  adjustmentAmount: 440,
  paymentId: 'payment-0001',
  invoiceId: 'invoice-2001',
}

function prepareDraftDatabase(seed: Partial<MemoryDatabase> = {}): MemoryDatabase {
  return prepareMemoryDatabase({
    customer: customers,
    invoice: [draftInvoice],
    invoiceTax: [draftTax],
    sales: [prepareSales('sales-0001', { customerId: 'customer-0002', salesAmount: 100_000, invoiceId: 'invoice-2001' })],
    payment: [preparePayment('payment-0001', { paymentDate: '2026-10-25', paymentAmount: 50_000, invoiceId: 'invoice-2001' })],
    refund: [draftRefund],
    adjustment: [draftAdjustment],
    ...seed,
  })
}

/** 発行日を入れ直して発行する。 */
async function issueOnScreen(database: MemoryDatabase, issueDate: string) {
  const { user } = await renderScreen('/invoices/invoice-2001', database)
  const issueField = screen.getByLabelText(text.label('issueDate'))
  await user.clear(issueField)
  await user.type(issueField, issueDate)
  await user.click(screen.getByRole('button', { name: text.label('issue') }))
}

function readTableTexts(captionName: string): string[][] {
  const table = screen.getByRole('table', { name: text.label(captionName) })
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? ''),
    )
}

async function expectProblem(fieldName: string, messageKey: MessageKey, params: MessageParams = {}) {
  const fieldLabel = text.label(fieldName)
  const field = screen.getByLabelText(fieldLabel)
  await waitFor(() => {
    expect(field).toHaveAccessibleDescription(text.message(messageKey, { ...params, field: fieldLabel }))
  })
}

describe('請求の詳細の画面', () => {
  test('残高を繰り越す請求書の並びで金額を出し、載せた売上・入金・返金・調整を並べる', async () => {
    await renderScreen('/invoices/invoice-2001', prepareDraftDatabase())

    expect(readTableTexts('invoiceBreakdown')).toEqual([
      [0, 49_000, 440, -49_440, 100_000, 10_000, 60_560].map((amount) => displayYen('ja', amount)),
    ])
    expect(readTableTexts('taxBreakdown')).toEqual([['10%', displayYen('ja', 100_000), displayYen('ja', 10_000)]])
    expect(readTableTexts('billedSales')).toEqual([['2026-10-15', '運賃', text.label('normal'), '10%', displayYen('ja', 100_000)]])
    expect(readTableTexts('billedPayments')).toEqual([
      ['2026-10-25', text.label('payment'), 'カ）オヤ', displayYen('ja', 50_000)],
      ['2026-10-28', text.label('refund'), '—', displayYen('ja', -1000)],
      ['2026-10-25', text.label('transferFee'), '—', displayYen('ja', 440)],
    ])
  })

  test('発行すると、発行日の年の次の請求番号を振り、発行と取消の操作をなくす', async () => {
    const database = prepareDraftDatabase({ invoiceCounter: [{ issueYear: 2026, lastNumber: 4 }] })

    await issueOnScreen(database, '2026-11-02')

    expect(await screen.findByRole('status')).toHaveTextContent(text.message('issueCompleted'))
    expect(await screen.findByText('2026-000005')).toBeVisible()
    expect(database.invoice[0]).toMatchObject({ invoiceNumber: '2026-000005', issueDate: '2026-11-02' })
    expect(screen.queryByRole('button', { name: text.label('issue') })).toBeNull()
    expect(screen.queryByRole('button', { name: text.label('closingCancel') })).toBeNull()
  })

  test('年が変わると、請求番号は 1 から振る', async () => {
    const database = prepareDraftDatabase({ invoiceCounter: [{ issueYear: 2026, lastNumber: 4 }] })

    await issueOnScreen(database, '2027-01-05')

    expect(await screen.findByText('2027-000001')).toBeVisible()
    expect(database.invoiceCounter).toEqual([
      { issueYear: 2026, lastNumber: 4 },
      { issueYear: 2027, lastNumber: 1 },
    ])
  })

  test('発行日が請求締め日より前なら発行せず、番号も進めない', async () => {
    const database = prepareDraftDatabase({ invoiceCounter: [{ issueYear: 2026, lastNumber: 4 }] })

    await issueOnScreen(database, '2026-10-30')

    await expectProblem('issueDate', 'earlyIssueDate', { closingDate: '2026-10-31' })
    expect(database.invoice[0]?.invoiceNumber).toBeNull()
    expect(database.invoiceCounter).toEqual([{ issueYear: 2026, lastNumber: 4 }])
  })

  test('締めを取り消すと請求を消し、載せた行を請求に載せる前へ戻して一覧へ移る', async () => {
    const database = prepareDraftDatabase()
    const { user } = await renderScreen('/invoices/invoice-2001', database)

    await user.click(screen.getByRole('button', { name: text.label('closingCancel') }))

    expect(await screen.findByRole('heading', { name: text.label('invoiceList') })).toBeVisible()
    expect(database.invoice).toEqual([])
    expect(database.invoiceTax).toEqual([])
    expect([
      ...database.sales.map((row) => row.invoiceId),
      ...database.payment.map((row) => row.invoiceId),
      ...database.refund.map((row) => row.invoiceId),
      ...database.adjustment.map((row) => row.invoiceId),
    ]).toEqual([null, null, null, null])
  })

  test('発行した請求には、発行と締めの取消の操作を出さない', async () => {
    await renderScreen('/invoices/invoice-1001', prepareMemoryDatabase({ customer: customers, invoice: [issuedOctoberInvoice] }))

    expect(screen.getByText('2026-000001')).toBeVisible()
    expect(screen.queryByRole('button', { name: text.label('issue') })).toBeNull()
    expect(screen.queryByRole('button', { name: text.label('closingCancel') })).toBeNull()
  })

  test('請求の一覧から詳細へ移れる', async () => {
    const { user } = await renderScreen('/invoices', prepareDraftDatabase())

    expect(readTableTexts('invoiceList')).toEqual([
      ['2026-10-31', '株式会社親', '2026-11-30', displayYen('ja', 60_560), text.message('unissuedState')],
    ])
    await user.click(screen.getByRole('link', { name: '2026-10-31' }))

    expect(await screen.findByRole('heading', { name: text.label('invoiceDetail') })).toBeVisible()
  })
})
