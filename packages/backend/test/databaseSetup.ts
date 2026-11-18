import pg from 'pg'
import { applyMigrations } from '../database/applyMigrations'
import { testDatabaseUrl } from './testDatabase'

/** テストの前に、空のスキーマへマイグレーションを当て直す。 */
export default async function prepareTestDatabase(): Promise<void> {
  const client = new pg.Client({ connectionString: testDatabaseUrl })
  await client.connect()
  await client.query('DROP SCHEMA public CASCADE')
  await client.query('CREATE SCHEMA public')
  await client.end()
  await applyMigrations(testDatabaseUrl)
}
