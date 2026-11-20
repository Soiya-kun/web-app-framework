// 請求を締めるシナリオのケース。残高を繰り越す請求書の金額と、締めの規則を業務の場面ごとに確かめる。
import { confirmScenario, operateScenario } from '@app/flow'
import { describeScenario } from '@app/flow/vitest'
import type { Adjustment, Invoice, MemoryDatabase, Stored } from '@app/backend/testing'
import { prepareText } from '@app/vocabulary/text'
import { expect } from 'vitest'
import { customers, issuedOctoberInvoice, preparePayment, prepareSales } from '../../test/billingSeed'
import { launchApp } from '../../test/launchApp'
import { closeInvoice, type ClosingInput } from './closeInvoice'

/** モック DB に行を入れて画面を開き、請求を締める。 */
async function closeOnScreen(seed: Partial<MemoryDatabase>, closing: ClosingInput) {
  const app = await launchApp({ customer: customers, ...seed })
  await operateScenario(closeInvoice, app.screen, closing)
  return app
}

/** 新しくできた請求の行（ID はテストの採番で id-0001）。 */
function findCreatedInvoice(database: MemoryDatabase): Stored<Invoice> | undefined {
  return database.invoice.find((row) => row.invoiceId === 'id-0001')
}

const text = prepareText('ja')

const parentOctober: ClosingInput = { billingCustomer: '株式会社親', closingDate: '2026-10-31' }
const parentNovember: ClosingInput = { billingCustomer: '株式会社親', closingDate: '2026-11-30' }

const transferFee: Stored<Adjustment> = {
  adjustmentId: 'adjustment-0001',
  billingCustomerId: 'customer-0001',
  adjustmentDate: '2026-11-25',
  adjustmentKind: 'transferFee',
  adjustmentAmount: 440,
  paymentId: 'payment-0002',
  invoiceId: null,
}

describeScenario(closeInvoice, (cases) => {
  cases.main('初回の締め: 子会社の売上も請求先の親会社にまとめ、税率ごとに消費税を計算する。締め日より後の売上は載せない', async () => {
    const app = await closeOnScreen(
      {
        sales: [
          prepareSales('sales-0001', { customerId: 'customer-0002', salesDate: '2026-10-15', salesAmount: 100_000, taxRate: 10 }),
          prepareSales('sales-0002', { salesDate: '2026-10-20', salesAmount: 20_000, taxRate: 8 }),
          prepareSales('sales-0003', { salesDate: '2026-10-25', salesKind: 'return', salesAmount: -5000, taxRate: 8 }),
          prepareSales('sales-0004', { salesDate: '2026-11-01', salesAmount: 9999 }),
        ],
      },
      parentOctober,
    )

    await confirmScenario(closeInvoice, app.screen, { ...parentOctober, breakdown: { currentInvoiceAmount: 126_200 } })
    expect(findCreatedInvoice(app.database)).toEqual({
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
    expect(app.database.invoiceTax).toEqual([
      { invoiceId: 'id-0001', taxRate: 10, taxableAmount: 100_000, taxAmount: 10_000 },
      { invoiceId: 'id-0001', taxRate: 8, taxableAmount: 15_000, taxAmount: 1200 },
    ])
    expect(app.database.sales.map((row) => [row.salesId, row.invoiceId])).toEqual([
      ['sales-0001', 'id-0001'],
      ['sales-0002', 'id-0001'],
      ['sales-0003', 'id-0001'],
      ['sales-0004', null],
    ])
  })

  cases.vary('分割入金と振込手数料: 2回の入金と手数料の調整で、前回請求額を繰越 0 にする', async () => {
    const app = await closeOnScreen(
      {
        invoice: [issuedOctoberInvoice],
        payment: [
          preparePayment('payment-0001', { paymentDate: '2026-11-10', paymentAmount: 60_000 }),
          preparePayment('payment-0002', { paymentDate: '2026-11-25', paymentAmount: 65_760 }),
        ],
        adjustment: [transferFee],
        sales: [prepareSales('sales-0001', { salesDate: '2026-11-15', salesAmount: 10_000 })],
      },
      parentNovember,
    )

    await confirmScenario(closeInvoice, app.screen, { ...parentNovember, breakdown: { carriedAmount: 0 } })
    expect(findCreatedInvoice(app.database)).toMatchObject({
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
    expect(app.database.payment.map((row) => row.invoiceId)).toEqual(['id-0001', 'id-0001'])
    expect(app.database.adjustment.map((row) => row.invoiceId)).toEqual(['id-0001'])
  })

  cases.vary('不足入金: 足りない分を繰越額として次の請求に載せる', async () => {
    const app = await closeOnScreen(
      { invoice: [issuedOctoberInvoice], payment: [preparePayment('payment-0001', { paymentAmount: 100_000 })] },
      parentNovember,
    )

    await confirmScenario(closeInvoice, app.screen, { ...parentNovember, breakdown: { carriedAmount: 26_200 } })
    expect(findCreatedInvoice(app.database)).toMatchObject({ carriedAmount: 26_200, invoiceAmount: 26_200 })
  })

  cases.vary('過入金: 多く受け取った分は負の繰越額（前受）として次へ繰り越す', async () => {
    const app = await closeOnScreen(
      { invoice: [issuedOctoberInvoice], payment: [preparePayment('payment-0001', { paymentDate: '2026-11-20', paymentAmount: 136_200 })] },
      parentNovember,
    )

    await confirmScenario(closeInvoice, app.screen, { ...parentNovember, breakdown: { currentInvoiceAmount: -10_000 } })
    expect(findCreatedInvoice(app.database)).toMatchObject({ paymentAmount: 136_200, carriedAmount: -10_000, invoiceAmount: -10_000 })
  })

  cases.vary('返金: 過入金を返金すると、今回入金額から差し引く', async () => {
    const app = await closeOnScreen(
      {
        invoice: [issuedOctoberInvoice],
        payment: [preparePayment('payment-0001', { paymentDate: '2026-11-20', paymentAmount: 136_200 })],
        refund: [{ refundId: 'refund-0001', paymentId: 'payment-0001', refundDate: '2026-11-25', refundAmount: 10_000, invoiceId: null }],
      },
      parentNovember,
    )

    await confirmScenario(closeInvoice, app.screen, { ...parentNovember, breakdown: { currentPaymentAmount: 126_200 } })
    expect(findCreatedInvoice(app.database)).toMatchObject({ paymentAmount: 126_200, carriedAmount: 0, invoiceAmount: 0 })
    expect(app.database.refund.map((row) => row.invoiceId)).toEqual(['id-0001'])
  })

  cases.vary('一括入金: 2か月分（10月の未入金を繰り越した11月の請求）を1回で入金すると、繰越 0 になる', async () => {
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
    const closing: ClosingInput = { billingCustomer: '株式会社親', closingDate: '2026-12-31' }
    const app = await closeOnScreen(
      {
        invoice: [issuedOctoberInvoice, novemberInvoice],
        payment: [preparePayment('payment-0001', { paymentDate: '2026-12-20', paymentAmount: 137_200 })],
      },
      closing,
    )

    await confirmScenario(closeInvoice, app.screen, { ...closing, breakdown: { previousInvoiceAmount: 137_200 } })
    expect(findCreatedInvoice(app.database)).toMatchObject({
      previousInvoiceId: 'invoice-1002',
      previousAmount: 137_200,
      paymentAmount: 137_200,
      carriedAmount: 0,
      invoiceAmount: 0,
    })
  })

  cases.vary('振込人を特定できていない入金（仮受）は、請求に載せない', async () => {
    const app = await closeOnScreen(
      {
        sales: [prepareSales('sales-0001', { salesAmount: 10_000 })],
        payment: [preparePayment('payment-0001', { paymentDate: '2026-10-20', paymentAmount: 11_000, customerId: null, payerName: 'ヤマダ タロウ' })],
      },
      parentOctober,
    )

    await confirmScenario(closeInvoice, app.screen, { ...parentOctober, breakdown: { currentPaymentAmount: 0 } })
    expect(findCreatedInvoice(app.database)).toMatchObject({ paymentAmount: 0, invoiceAmount: 11_000 })
    expect(app.database.payment.map((row) => row.invoiceId)).toEqual([null])
  })

  cases.vary('締めた後に登録した、前回の締め日より前の日付の売上は、次の請求に載せる', async () => {
    const app = await closeOnScreen(
      { invoice: [issuedOctoberInvoice], sales: [prepareSales('sales-0001', { salesDate: '2026-10-28', salesAmount: 5000 })] },
      parentNovember,
    )

    await confirmScenario(closeInvoice, app.screen, { ...parentNovember, breakdown: { currentSalesAmount: 5000 } })
    expect(findCreatedInvoice(app.database)).toMatchObject({ carriedAmount: 126_200, salesAmount: 5000, taxAmount: 500, invoiceAmount: 131_700 })
  })

  cases.vary('20日締め翌月10日払いの請求先は、入金期日を翌月10日にする', async () => {
    const closing: ClosingInput = { billingCustomer: '株式会社二十日', closingDate: '2026-10-20' }
    const app = await closeOnScreen({ sales: [prepareSales('sales-0001', { customerId: 'customer-0003', salesDate: '2026-10-05' })] }, closing)

    await confirmScenario(closeInvoice, app.screen, closing)
    expect(findCreatedInvoice(app.database)).toMatchObject({ closingDate: '2026-10-20', dueDate: '2026-11-10' })
  })

  cases.vary('末締めは2月なら28日で締め、翌月末を入金期日にする', async () => {
    const closing: ClosingInput = { billingCustomer: '株式会社親', closingDate: '2027-02-28' }
    const app = await closeOnScreen({ sales: [prepareSales('sales-0001', { salesDate: '2027-02-10' })] }, closing)

    await confirmScenario(closeInvoice, app.screen, closing)
    expect(findCreatedInvoice(app.database)).toMatchObject({ closingDate: '2027-02-28', dueDate: '2027-03-31' })
  })

  cases.vary('子会社（請求先がほかの顧客）は請求先の選択肢に出さない', async () => {
    const app = await launchApp({ customer: customers })
    await app.screen.go('invoiceClosing')

    await app.screen.expectOptions('billingCustomer', [text.message('selectionPrompt'), '株式会社親', '株式会社二十日'])
  })

  cases.extend('invalidClosingDay', '20日締めの請求先を月末で締めようとすると止める', async () => {
    const app = await closeOnScreen(
      { sales: [prepareSales('sales-0001', { customerId: 'customer-0003' })] },
      { billingCustomer: '株式会社二十日', closingDate: '2026-10-31' },
    )

    await app.screen.expectProblem('closingDate', 'closingDayRequired', { closingDay: 20 })
    expect(app.database.invoice).toEqual([])
  })

  cases.extend('invalidClosingDay', '末締めの請求先を月末以外で締めようとすると止める', async () => {
    const app = await closeOnScreen({ sales: [prepareSales('sales-0001', {})] }, { billingCustomer: '株式会社親', closingDate: '2026-10-30' })

    await app.screen.expectProblem('closingDate', 'monthEndRequired')
  })

  cases.extend('unissuedPreviousInvoice', '前回の請求が未発行なら締めない', async () => {
    const app = await closeOnScreen({ invoice: [{ ...issuedOctoberInvoice, invoiceNumber: null, issueDate: null }] }, parentNovember)

    await app.screen.expectAlert('unissuedInvoice')
    expect(app.database.invoice).toHaveLength(1)
  })

  cases.extend('earlyClosingDate', '前回の締め日以前の日では締めない', async () => {
    const app = await closeOnScreen({ invoice: [issuedOctoberInvoice], sales: [prepareSales('sales-0001', {})] }, parentOctober)

    await app.screen.expectProblem('closingDate', 'earlyClosingDate', { previousDate: '2026-10-31' })
  })

  cases.extend('emptyClosing', '前回からの残高も、載せる行もなければ締めない', async () => {
    const app = await closeOnScreen({}, parentOctober)

    await app.screen.expectAlert('emptyClosing')
    expect(app.database.invoice).toEqual([])
  })

  cases.extend('invalidFields', '請求先と請求締め日がなければ、まとめて止める', async () => {
    const app = await closeOnScreen({}, { billingCustomer: '', closingDate: '' })

    await app.screen.expectProblem('billingCustomer', 'selectionRequired')
    await app.screen.expectProblem('closingDate', 'inputRequired')
  })

  cases.extend('invalidFields', '実在しない日付は止める', async () => {
    const app = await closeOnScreen({}, { billingCustomer: '株式会社親', closingDate: '2026-02-30' })

    await app.screen.expectProblem('closingDate', 'invalidDate')
  })
})
