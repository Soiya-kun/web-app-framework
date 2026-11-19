import type { CustomerRepository } from './customer/customerRepository'
import type { InvoiceRepository } from './invoice/invoiceRepository'
import type { PayerNameRepository } from './payerName/payerNameRepository'
import type { PaymentRepository } from './payment/paymentRepository'
import type { SalesRepository } from './sales/salesRepository'

/** 1つのトランザクションの中で使う repository の組。本番は PostgreSQL、画面の結合テストはモック DB で作る。 */
export type RepositorySet = {
  readonly customerRepository: CustomerRepository
  readonly salesRepository: SalesRepository
  readonly invoiceRepository: InvoiceRepository
  readonly paymentRepository: PaymentRepository
  readonly payerNameRepository: PayerNameRepository
}

/** 処理を1つのトランザクションで行う。処理が例外で終わったら、書いた内容を取り消す。 */
export type RunTransaction = <Result>(work: (repositories: RepositorySet) => Promise<Result>) => Promise<Result>
