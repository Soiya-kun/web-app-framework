// 本番の部品。PostgreSQL の repository と、UUID の採番で組み立てる。
import type { AppDependency } from './handler/dependency'
import {
  preparePostgresPool,
  preparePostgresTransaction,
  type DatabaseConnection,
} from './repository/postgres/postgresDatabase'
import { prepareRandomIdGenerator } from './repository/randomIdGenerator'

export type { DatabaseConnection } from './repository/postgres/postgresDatabase'

export function prepareProductionDependency(connection: DatabaseConnection): AppDependency {
  return {
    runTransaction: preparePostgresTransaction(preparePostgresPool(connection)),
    idGenerator: prepareRandomIdGenerator(),
  }
}
