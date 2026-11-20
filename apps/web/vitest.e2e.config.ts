import { defineConfig } from 'vitest/config'

// pnpm test:e2e で動かす。業務フローを実ブラウザ・API サーバー・PostgreSQL で流す（Docker の PostgreSQL を使う）。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.test.ts'],
    globalSetup: ['e2e/browserSetup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
