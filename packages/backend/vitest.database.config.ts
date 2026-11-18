import { defineConfig } from 'vitest/config'

// pnpm test:database で動かす。Docker の PostgreSQL を使うテスト。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.database.test.ts'],
    globalSetup: ['test/databaseSetup.ts'],
    fileParallelism: false,
  },
})
