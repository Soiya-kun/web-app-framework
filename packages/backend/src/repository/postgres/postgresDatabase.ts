import pg from 'pg'
import type { RepositorySet, RunTransaction } from '../../domain/repositorySet'
import { prepareCustomerPostgresRepository } from './customerPostgresRepository'
import { prepareSalesPostgresRepository } from './salesPostgresRepository'
import { defineStatement, type Executor } from './statement'

const beginStatement = defineStatement<[]>('beginTransaction', 'BEGIN')
const commitStatement = defineStatement<[]>('commitTransaction', 'COMMIT')
const rollbackStatement = defineStatement<[]>('rollbackTransaction', 'ROLLBACK')

function readSafeInteger(text: string): number {
  const value = Number(text)
  if (!Number.isSafeInteger(value)) {
    throw new Error(`安全に扱える整数の範囲を超えています: ${text}`)
  }
  return value
}

function readDateText(text: string): string {
  return text
}

/** bigint は number に、date は YYYY-MM-DD の文字列のまま読む（日付をタイムゾーンでずらさない）。 */
const typeParsers = {
  getTypeParser: ((typeId: number, format?: 'text' | 'binary') => {
    if (typeId === pg.types.builtins.INT8) {
      return readSafeInteger
    }
    if (typeId === pg.types.builtins.DATE) {
      return readDateText
    }
    return pg.types.getTypeParser(typeId, format ?? 'text')
  }) as pg.CustomTypesConfig['getTypeParser'],
}

export function preparePostgresPool(connectionText: string): pg.Pool {
  return new pg.Pool({ connectionString: connectionText, types: typeParsers })
}

export function prepareClientExecutor(client: pg.ClientBase | pg.Pool): Executor {
  return {
    async execute(statement, values) {
      const result = await client.query({ text: statement.text, values: [...values] })
      return result.rows
    },
  }
}

export function preparePostgresRepositories(executor: Executor): RepositorySet {
  return {
    customerRepository: prepareCustomerPostgresRepository(executor),
    salesRepository: prepareSalesPostgresRepository(executor),
  }
}

/** 1つの接続で BEGIN・COMMIT を行い、処理が例外で終わったら ROLLBACK する。 */
export function preparePostgresTransaction(pool: pg.Pool): RunTransaction {
  return async (work) => {
    const client = await pool.connect()
    const executor = prepareClientExecutor(client)
    try {
      await executor.execute(beginStatement, [])
      const result = await work(preparePostgresRepositories(executor))
      await executor.execute(commitStatement, [])
      return result
    } catch (error) {
      await executor.execute(rollbackStatement, [])
      throw error
    } finally {
      client.release()
    }
  }
}
