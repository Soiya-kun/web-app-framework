import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['apps/web', 'packages/backend', 'packages/eslint-plugin', 'packages/translator', 'packages/vocabulary', 'infra'],
  },
})
