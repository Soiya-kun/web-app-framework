// 本番の部品。PostgreSQL の repository と、UUID の採番で組み立てる。
import type { AppDependency } from './handler/dependency'
import { preparePostgresPool, preparePostgresTransaction } from './repository/postgres/postgresDatabase'
import { prepareRandomIdGenerator } from './repository/randomIdGenerator'

export function prepareProductionDependency(connectionText: string): AppDependency {
  return {
    runTransaction: preparePostgresTransaction(preparePostgresPool(connectionText)),
    idGenerator: prepareRandomIdGenerator(),
  }
}
