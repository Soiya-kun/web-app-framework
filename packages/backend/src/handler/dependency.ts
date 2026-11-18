import type { CustomerRepository } from '../domain/customer/customerRepository'
import type { SalesRepository } from '../domain/sales/salesRepository'
import type { IdGenerator } from '../domain/shared/idGenerator'

/** handler が usecase に渡す部品。本番は実 DB の部品、画面の結合テストはモック DB の部品で組み立てる。 */
export type AppDependency = {
  readonly customerRepository: CustomerRepository
  readonly salesRepository: SalesRepository
  readonly idGenerator: IdGenerator
}
