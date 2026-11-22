import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import appPlugin from './packages/eslint-plugin/src/index'

const layerMessage = '層の依存の向きに反します（domain ← usecase、domain ← repository、usecase ← handler）。'

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/generated/**'] },
  tseslint.configs.recommended,

  // 単語帳と命名の文法は、アプリのコード（画面・バックエンド）に当てる。道具（lint・翻訳・単語帳の生成）は対象外。
  // 名前（変数・関数・型）だけでなく、ファイル名と、API・画面のパスも単語帳の言葉にする。
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/backend/**/*.ts'],
    // モック（pnpm dev:mock の API サーバーと開発パネル）は開発の道具なので対象外（業務の言葉を持たない）。
    ignores: ['**/*.config.ts', 'apps/web/mock/**'],
    plugins: { app: appPlugin },
    rules: {
      'app/known-words': 'error',
      'app/verb-first': 'error',
      'app/known-file-name': 'error',
      'app/known-path': 'error',
    },
  },

  // usecase は関数呼び出しの並びだけにする。
  {
    files: ['packages/backend/src/usecase/**/*.ts'],
    plugins: { app: appPlugin },
    rules: { 'app/flat-steps': 'error' },
  },

  // バックエンドの層の依存の向き。
  {
    files: ['packages/backend/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/usecase/**', '**/repository/**', '**/handler/**'], message: layerMessage }] }],
    },
  },
  {
    files: ['packages/backend/src/usecase/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/repository/**', '**/handler/**'], message: layerMessage }] }],
    },
  },
  {
    files: ['packages/backend/src/repository/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/usecase/**', '**/handler/**'], message: layerMessage }] }],
    },
  },

  // useEffect は一切使わない（useLayoutEffect・useInsertionEffect も同じ）。
  {
    files: ['apps/web/**/*.{ts,tsx}', 'apps/browser/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['useEffect', 'useLayoutEffect', 'useInsertionEffect'],
              message: 'useEffect 系は禁止です。docs/requirements.md の「useEffect の代わりの書き方」を参照してください。',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'React', property: 'useEffect', message: 'useEffect は禁止です。' },
        { object: 'React', property: 'useLayoutEffect', message: 'useLayoutEffect は禁止です。' },
        { object: 'React', property: 'useInsertionEffect', message: 'useInsertionEffect は禁止です。' },
      ],
    },
  },
)
