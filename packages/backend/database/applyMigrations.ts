// database/migration の SQL を、まだ当てていないものだけ名前の順に当てる。当てた名前は schema_migration に残す。
import { readdirSync, readFileSync } from 'node:fs'
import pg from 'pg'

const migrationDirectory = new URL('./migration/', import.meta.url)

export async function applyMigrations(connectionText: string): Promise<readonly string[]> {
  const client = new pg.Client({ connectionString: connectionText })
  await client.connect()
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migration (migration_name text PRIMARY KEY)')
    const appliedResult = await client.query<{ migrationName: string }>(
      'SELECT migration_name AS "migrationName" FROM schema_migration',
    )
    const appliedNames = new Set(appliedResult.rows.map((row) => row.migrationName))
    const fileNames = readdirSync(migrationDirectory)
      .filter((fileName) => fileName.endsWith('.sql'))
      .sort()
    const newNames = fileNames.filter((fileName) => !appliedNames.has(fileName))
    for (const fileName of newNames) {
      const migrationText = readFileSync(new URL(fileName, migrationDirectory), 'utf8')
      await client.query('BEGIN')
      await client.query(migrationText)
      await client.query('INSERT INTO schema_migration (migration_name) VALUES ($1)', [fileName])
      await client.query('COMMIT')
    }
    return newNames
  } finally {
    await client.end()
  }
}
