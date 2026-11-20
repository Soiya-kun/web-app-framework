// 本番の部品。PostgreSQL の repository と、UUID の採番で組み立てる。
import type pg from 'pg'
import type { AppDependency } from './handler/dependency'
import {
  preparePostgresPool,
  preparePostgresTransaction,
  type DatabaseConnection,
} from './repository/postgres/postgresDatabase'
import { prepareRandomIdGenerator } from './repository/randomIdGenerator'

export type { DatabaseConnection } from './repository/postgres/postgresDatabase'
export { preparePostgresPool } from './repository/postgres/postgresDatabase'

export function prepareProductionDependency(connection: DatabaseConnection): AppDependency {
  return preparePoolDependency(preparePostgresPool(connection))
}

/** 接続のプールを渡して組み立てる。実ブラウザの E2E は、終わったときにプールを閉じるのに使う。 */
export function preparePoolDependency(pool: pg.Pool): AppDependency {
  return {
    runTransaction: preparePostgresTransaction(pool),
    idGenerator: prepareRandomIdGenerator(),
  }
}
