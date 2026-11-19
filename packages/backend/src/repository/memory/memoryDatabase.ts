import type { Adjustment } from '../../domain/adjustment/entity'
import type { Customer } from '../../domain/customer/entity'
import type { Invoice, InvoiceTax } from '../../domain/invoice/entity'
import type { PayerNameEntry } from '../../domain/payerName/entity'
import type { Payment } from '../../domain/payment/entity'
import type { Refund } from '../../domain/refund/entity'
import type { Sales } from '../../domain/sales/entity'
import type { Stored } from '../../domain/shared/brand'

/** invoice_counter テーブルの1行。 */
export type InvoiceCounterRow = {
  readonly issueYear: number
  readonly lastNumber: number
}

/** 画面の結合テストで本物の DB の代わりに使う。テーブルごとに、保存の形（Stored）の行の配列を持つ。 */
export type MemoryDatabase = {
  readonly customer: Stored<Customer>[]
  readonly payerName: Stored<PayerNameEntry>[]
  readonly invoice: Stored<Invoice>[]
  readonly invoiceTax: Stored<InvoiceTax>[]
  readonly invoiceCounter: InvoiceCounterRow[]
  readonly sales: Stored<Sales>[]
  readonly payment: Stored<Payment>[]
  readonly refund: Stored<Refund>[]
  readonly adjustment: Stored<Adjustment>[]
}

const tableNames = ['customer', 'payerName', 'invoice', 'invoiceTax', 'invoiceCounter', 'sales', 'payment', 'refund', 'adjustment'] as const

export function prepareMemoryDatabase(seed: Partial<MemoryDatabase> = {}): MemoryDatabase {
  return {
    customer: [...(seed.customer ?? [])],
    payerName: [...(seed.payerName ?? [])],
    invoice: [...(seed.invoice ?? [])],
    invoiceTax: [...(seed.invoiceTax ?? [])],
    invoiceCounter: [...(seed.invoiceCounter ?? [])],
    sales: [...(seed.sales ?? [])],
    payment: [...(seed.payment ?? [])],
    refund: [...(seed.refund ?? [])],
    adjustment: [...(seed.adjustment ?? [])],
  }
}

/** 失敗したトランザクションの取り消しに使うため、全テーブルの行を写し取る。 */
export function copyMemoryDatabase(database: MemoryDatabase): MemoryDatabase {
  return structuredClone(database)
}

/** 写し取った行へ、全テーブルを戻す。 */
export function restoreMemoryDatabase(database: MemoryDatabase, copy: MemoryDatabase): void {
  for (const tableName of tableNames) {
    const rows: unknown[] = database[tableName]
    rows.splice(0, rows.length, ...copy[tableName])
  }
}
