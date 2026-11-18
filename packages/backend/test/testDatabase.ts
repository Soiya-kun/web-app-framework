/** テスト用の PostgreSQL（docker compose の test-database）。 */
export const testDatabaseUrl = process.env['TEST_DATABASE_URL'] ?? 'postgres://app:app@localhost:55433/app'
