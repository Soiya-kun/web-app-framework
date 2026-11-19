// repository の契約のテスト。同じテストをモック DB と PostgreSQL に流し、振る舞いがずれていないことを確かめる。
import { beforeEach, describe, expect, test } from 'vitest'
import type { Adjustment } from '../../src/domain/adjustment/entity'
import type { Customer } from '../../src/domain/customer/entity'
import type { CustomerId } from '../../src/domain/customer/value/customerId'
import type { Invoice } from '../../src/domain/invoice/entity'
import type { InvoiceCreate } from '../../src/domain/invoice/invoiceCreate'
import type { InvoiceIssue } from '../../src/domain/invoice/invoiceIssue'
import type { ClosingCancel } from '../../src/domain/invoice/closingCancel'
import type { PayerNameSave } from '../../src/domain/payerName/payerNameSave'
import type { PaymentCreate } from '../../src/domain/payment/paymentCreate'
import type { PaymentIdentify } from '../../src/domain/payment/paymentIdentify'
import type { PayerName } from '../../src/domain/payment/value/payerName'
import type { PaymentId } from '../../src/domain/payment/value/paymentId'
import type { ClosingDate } from '../../src/domain/invoice/value/closingDate'
import type { InvoiceId } from '../../src/domain/invoice/value/invoiceId'
import type { Payment } from '../../src/domain/payment/entity'
import type { Refund } from '../../src/domain/refund/entity'
import type { RepositorySet, RunTransaction } from '../../src/domain/repositorySet'
import type { Sales } from '../../src/domain/sales/entity'
import type { SalesCreate } from '../../src/domain/sales/salesCreate'
import type { Stored } from '../../src/domain/shared/brand'
import { ConflictError, NotFoundError } from '../../src/domain/shared/error'
import type { MemoryDatabase } from '../../src/repository/memory/memoryDatabase'

/** テストの対象。テストのための行の出し入れは、対象ごとに用意する。 */
export type RepositoryTarget = {
  readonly repositories: RepositorySet
  readonly runTransaction: RunTransaction
  seedTables(seed: Partial<MemoryDatabase>): Promise<void>
  readTables(): Promise<MemoryDatabase>
}

export const parentCustomer: Stored<Customer> = {
  customerId: 'customer-0001',
  customerName: '株式会社親',
  billingCustomerId: 'customer-0001',
  closingDay: 31,
  collectionMonthOffset: 1,
  collectionDay: 31,
}

export const childCustomer: Stored<Customer> = {
  customerId: 'customer-0002',
  customerName: '株式会社子',
  billingCustomerId: 'customer-0001',
  closingDay: 31,
  collectionMonthOffset: 1,
  collectionDay: 31,
}

export const otherCustomer: Stored<Customer> = {
  customerId: 'customer-0003',
  customerName: '株式会社他',
  billingCustomerId: 'customer-0003',
  closingDay: 20,
  collectionMonthOffset: 1,
  collectionDay: 10,
}

/** 子会社の売上（請求先は親会社）。 */
export const childSales: Stored<Sales> = {
  salesId: 'sales-0001',
  customerId: 'customer-0002',
  salesDate: '2026-10-15',
  salesKind: 'normal',
  itemName: '運賃',
  salesAmount: 100_000,
  taxRate: 10,
  invoiceId: null,
}

/** 請求締め日より後の売上（10月の締めには載らない）。 */
export const laterSales: Stored<Sales> = {
  salesId: 'sales-0002',
  customerId: 'customer-0001',
  salesDate: '2026-11-05',
  salesKind: 'return',
  itemName: '返品',
  salesAmount: -3000,
  taxRate: 8,
  invoiceId: null,
}

/** ほかの請求先の売上。 */
export const otherSales: Stored<Sales> = {
  salesId: 'sales-0003',
  customerId: 'customer-0003',
  salesDate: '2026-10-10',
  salesKind: 'normal',
  itemName: '保管料',
  salesAmount: 5000,
  taxRate: 10,
  invoiceId: null,
}

export const parentPayment: Stored<Payment> = {
  paymentId: 'payment-0001',
  paymentDate: '2026-10-25',
  paymentMethod: 'transfer',
  paymentAmount: 50_000,
  payerName: 'カ）オヤ',
  customerId: 'customer-0001',
  invoiceId: null,
}

/** 振込人を特定できていない入金（仮受）。請求に載せない。 */
export const unknownPayment: Stored<Payment> = {
  paymentId: 'payment-0002',
  paymentDate: '2026-10-26',
  paymentMethod: 'transfer',
  paymentAmount: 7000,
  payerName: 'ヤマダ タロウ',
  customerId: null,
  invoiceId: null,
}

export const parentRefund: Stored<Refund> = {
  refundId: 'refund-0001',
  paymentId: 'payment-0001',
  refundDate: '2026-10-28',
  refundAmount: 1000,
  invoiceId: null,
}

export const parentAdjustment: Stored<Adjustment> = {
  adjustmentId: 'adjustment-0001',
  billingCustomerId: 'customer-0001',
  adjustmentDate: '2026-10-25',
  adjustmentKind: 'transferFee',
  adjustmentAmount: 440,
  paymentId: 'payment-0001',
  invoiceId: null,
}

export const octoberInvoice: Stored<Invoice> = {
  invoiceId: 'invoice-0001',
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

const octoberInvoiceCreate = {
  invoice: octoberInvoice,
  taxes: [{ invoiceId: 'invoice-0001', taxRate: 10, taxableAmount: 100_000, taxAmount: 10_000 }],
  salesIds: ['sales-0001'],
  paymentIds: ['payment-0001'],
  refundIds: ['refund-0001'],
  adjustmentIds: ['adjustment-0001'],
} as unknown as InvoiceCreate

const parentId = 'customer-0001' as CustomerId
const octoberClosingDate = '2026-10-31' as ClosingDate
const octoberInvoiceId = 'invoice-0001' as InvoiceId

function markBilled<Row extends { readonly invoiceId: string | null }>(row: Row): Row {
  return { ...row, invoiceId: 'invoice-0001' }
}

export function describeRepositoryContract(name: string, prepareTarget: () => Promise<RepositoryTarget>): void {
  describe(`${name} の repository`, () => {
    let target: RepositoryTarget

    beforeEach(async () => {
      target = await prepareTarget()
      await target.seedTables({ customer: [parentCustomer, childCustomer, otherCustomer] })
    })

    describe('顧客', () => {
      test('ID で取得する', async () => {
        expect(await target.repositories.customerRepository.findCustomer('customer-0002' as CustomerId)).toEqual(childCustomer)
      })

      test('ない顧客は NotFoundError にする', async () => {
        await expect(target.repositories.customerRepository.lockCustomer('customer-9999' as CustomerId)).rejects.toBeInstanceOf(
          NotFoundError,
        )
      })

      test('ID の順に一覧する', async () => {
        expect(await target.repositories.customerRepository.listCustomers()).toEqual([parentCustomer, childCustomer, otherCustomer])
      })
    })

    describe('売上', () => {
      const salesCreate = { ...laterSales, invoiceId: undefined } as unknown as SalesCreate

      test('入力境界の項目のまま1行として保存し、請求にはまだ載せない', async () => {
        await target.repositories.salesRepository.createSales(salesCreate)

        expect((await target.readTables()).sales).toEqual([laterSales])
      })

      test('同じ ID の売上は保存しない', async () => {
        await target.repositories.salesRepository.createSales(salesCreate)

        await expect(target.repositories.salesRepository.createSales(salesCreate)).rejects.toThrow()
      })

      test('トランザクションの処理が例外で終わったら、書いた内容を取り消す', async () => {
        await expect(
          target.runTransaction(async (repositories) => {
            await repositories.salesRepository.createSales(salesCreate)
            throw new Error('途中で失敗')
          }),
        ).rejects.toThrow('途中で失敗')

        expect((await target.readTables()).sales).toEqual([])
      })
    })

    describe('入金と振込依頼人名', () => {
      const paymentCreate = { ...unknownPayment, invoiceId: undefined } as unknown as PaymentCreate

      test('入金を、入力境界の項目のまま1行として保存し、請求にはまだ載せない', async () => {
        await target.repositories.paymentRepository.createPayment(paymentCreate)

        expect((await target.readTables()).payment).toEqual([unknownPayment])
        expect(await target.repositories.paymentRepository.findPayment('payment-0002' as PaymentId)).toEqual(unknownPayment)
      })

      test('入金日の新しい順に、顧客の名前（仮受は null）を添えて一覧する', async () => {
        await target.seedTables({ payment: [parentPayment, unknownPayment] })

        expect(await target.repositories.paymentRepository.listPayments()).toEqual([
          { ...unknownPayment, customerName: null },
          { ...parentPayment, customerName: '株式会社親' },
        ])
      })

      test('仮受の入金に顧客を入れる。特定済みの入金には入れない', async () => {
        await target.seedTables({ payment: [parentPayment, unknownPayment] })

        await target.repositories.paymentRepository.identifyPayment({ paymentId: 'payment-0002', customerId: 'customer-0001' } as PaymentIdentify)

        expect((await target.readTables()).payment.map((row) => row.customerId)).toEqual(['customer-0001', 'customer-0001'])
        await expect(
          target.repositories.paymentRepository.identifyPayment({ paymentId: 'payment-0001', customerId: 'customer-0003' } as PaymentIdentify),
        ).rejects.toBeInstanceOf(ConflictError)
      })

      test('振込依頼人名を覚え、同じ名前は新しい顧客で上書きする', async () => {
        const payerNameRepository = target.repositories.payerNameRepository
        await payerNameRepository.savePayerNames([{ payerName: 'カ)オヤ', customerId: 'customer-0003' } as PayerNameSave])
        await payerNameRepository.savePayerNames([{ payerName: 'カ)オヤ', customerId: 'customer-0001' } as PayerNameSave])
        await payerNameRepository.savePayerNames([])

        expect((await target.readTables()).payerName).toEqual([{ payerName: 'カ)オヤ', customerId: 'customer-0001' }])
        expect(await payerNameRepository.findPayerCustomer('カ)オヤ' as PayerName)).toEqual(parentCustomer)
        expect(await payerNameRepository.findPayerCustomer('ヤマダ タロウ' as PayerName)).toBeUndefined()
      })
    })

    describe('請求', () => {
      beforeEach(async () => {
        await target.seedTables({
          sales: [childSales, laterSales, otherSales],
          payment: [parentPayment, unknownPayment],
          refund: [parentRefund],
          adjustment: [parentAdjustment],
        })
      })

      test('締めの対象は、請求先の（子会社を含む）締め日までの、まだ載せていない行。仮受の入金は入れない', async () => {
        const entries = await target.repositories.invoiceRepository.listUnbilledEntries(parentId, octoberClosingDate)

        expect(entries).toEqual({
          sales: [childSales],
          payments: [parentPayment],
          refunds: [parentRefund],
          adjustments: [parentAdjustment],
        })
      })

      test('請求を保存し、行を請求に載せる', async () => {
        await target.repositories.invoiceRepository.createInvoice(octoberInvoiceCreate)

        const tables = await target.readTables()
        expect(tables.invoice).toEqual([octoberInvoice])
        expect(tables.invoiceTax).toEqual([{ invoiceId: 'invoice-0001', taxRate: 10, taxableAmount: 100_000, taxAmount: 10_000 }])
        expect(tables.sales).toEqual([markBilled(childSales), laterSales, otherSales])
        expect(tables.payment).toEqual([markBilled(parentPayment), unknownPayment])
        expect(tables.refund).toEqual([markBilled(parentRefund)])
        expect(tables.adjustment).toEqual([markBilled(parentAdjustment)])
        expect(await target.repositories.invoiceRepository.listUnbilledEntries(parentId, octoberClosingDate)).toEqual({
          sales: [],
          payments: [],
          refunds: [],
          adjustments: [],
        })
      })

      test('請求書の中身として、見出しと載せた行を返す', async () => {
        await target.repositories.invoiceRepository.createInvoice(octoberInvoiceCreate)

        expect(await target.repositories.invoiceRepository.findInvoiceDetail(octoberInvoiceId)).toEqual({
          invoice: { ...octoberInvoice, billingCustomerName: '株式会社親' },
          taxes: [{ invoiceId: 'invoice-0001', taxRate: 10, taxableAmount: 100_000, taxAmount: 10_000 }],
          sales: [markBilled(childSales)],
          payments: [markBilled(parentPayment)],
          refunds: [markBilled(parentRefund)],
          adjustments: [markBilled(parentAdjustment)],
        })
        expect(await target.repositories.invoiceRepository.listInvoices()).toEqual([
          { ...octoberInvoice, billingCustomerName: '株式会社親' },
        ])
        expect(await target.repositories.invoiceRepository.findLatestInvoice(parentId)).toEqual(octoberInvoice)
      })

      test('ほかの操作で先に載った行があれば止め、何も変えない', async () => {
        await target.seedTables({ invoice: [{ ...octoberInvoice, invoiceId: 'invoice-0000', closingDate: '2026-09-30' }] })
        await target.seedTables({ sales: [{ ...otherSales, salesId: 'sales-0009', customerId: 'customer-0002', invoiceId: 'invoice-0000' }] })
        const duplicateCreate = { ...octoberInvoiceCreate, salesIds: ['sales-0001', 'sales-0009'] } as unknown as InvoiceCreate

        await expect(
          target.runTransaction((repositories) => repositories.invoiceRepository.createInvoice(duplicateCreate)),
        ).rejects.toBeInstanceOf(ConflictError)

        const tables = await target.readTables()
        expect(tables.invoice.map((row) => row.invoiceId)).toEqual(['invoice-0000'])
        expect(tables.sales.find((row) => row.salesId === 'sales-0001')?.invoiceId).toBeNull()
      })

      test('請求番号は、発行した年ごとに 1 から欠番なく振る', async () => {
        const invoiceRepository = target.repositories.invoiceRepository

        expect([
          await invoiceRepository.takeInvoiceNumber(2026),
          await invoiceRepository.takeInvoiceNumber(2026),
          await invoiceRepository.takeInvoiceNumber(2027),
        ]).toEqual([1, 2, 1])
      })

      test('発行は発行前の請求に1度だけ行える', async () => {
        await target.repositories.invoiceRepository.createInvoice(octoberInvoiceCreate)
        const invoiceIssue = { invoiceId: 'invoice-0001', invoiceNumber: '2026-000001', issueDate: '2026-11-02' } as InvoiceIssue

        await target.repositories.invoiceRepository.issueInvoice(invoiceIssue)

        expect((await target.readTables()).invoice).toEqual([
          { ...octoberInvoice, invoiceNumber: '2026-000001', issueDate: '2026-11-02' },
        ])
        await expect(target.repositories.invoiceRepository.issueInvoice(invoiceIssue)).rejects.toBeInstanceOf(ConflictError)
      })

      test('締めの取消は、載せた行を戻して請求を消す', async () => {
        await target.repositories.invoiceRepository.createInvoice(octoberInvoiceCreate)

        await target.repositories.invoiceRepository.cancelClosing({ invoiceId: 'invoice-0001' } as ClosingCancel)

        const tables = await target.readTables()
        expect(tables.invoice).toEqual([])
        expect(tables.invoiceTax).toEqual([])
        expect(tables.sales).toEqual([childSales, laterSales, otherSales])
        expect(tables.payment).toEqual([parentPayment, unknownPayment])
        expect(tables.refund).toEqual([parentRefund])
        expect(tables.adjustment).toEqual([parentAdjustment])
      })

      test('発行した請求の締めは取り消さない', async () => {
        await target.repositories.invoiceRepository.createInvoice(octoberInvoiceCreate)
        await target.repositories.invoiceRepository.issueInvoice({
          invoiceId: 'invoice-0001',
          invoiceNumber: '2026-000001',
          issueDate: '2026-11-02',
        } as InvoiceIssue)

        await expect(
          target.runTransaction((repositories) =>
            repositories.invoiceRepository.cancelClosing({ invoiceId: 'invoice-0001' } as ClosingCancel),
          ),
        ).rejects.toBeInstanceOf(ConflictError)
        expect((await target.readTables()).sales[0]?.invoiceId).toBe('invoice-0001')
      })
    })
  })
}
