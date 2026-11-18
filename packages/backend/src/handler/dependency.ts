import type { RunTransaction } from '../domain/repositorySet'
import type { IdGenerator } from '../domain/shared/idGenerator'

/** handler が usecase に渡す部品。本番は PostgreSQL、画面の結合テストはモック DB で組み立てる。 */
export type AppDependency = {
  /** 1リクエストを1トランザクションで行う。repository はこの中で受け取る。 */
  readonly runTransaction: RunTransaction
  readonly idGenerator: IdGenerator
}
