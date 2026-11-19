import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['apps/web', 'apps/browser', 'packages/backend', 'packages/eslint-plugin', 'packages/flow', 'packages/translator', 'packages/vocabulary', 'infra'],
  },
})
