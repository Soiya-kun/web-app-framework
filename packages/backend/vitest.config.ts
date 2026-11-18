import { defineConfig } from 'vitest/config'

// pnpm test で動かす。DB の要らないテスト（モック DB の repository など）。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.database.test.ts'],
  },
})
