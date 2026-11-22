import { execFile, execFileSync } from 'node:child_process'
import { join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'

const repositoryRoot = join(import.meta.dirname, '../..')
const generator = [join(import.meta.dirname, 'node_modules/.bin/tsx'), [join(repositoryRoot, 'packages/translator/src/model/cli.ts')]] as const
// モデルの作り直しのもとになるソース（業務フロー・シナリオ・画面・バックエンド・単語帳）。
const watchedDirectories = ['.claude/skills', 'apps/web/flow', 'apps/web/scenario', 'apps/web/role', 'apps/web/meeting', 'apps/web/step', 'apps/web/legacy', 'apps/web/estimate', 'apps/web/effort', 'apps/web/src', 'packages/backend/src', 'packages/backend/database', 'packages/vocabulary/words']

/**
 * モデル（generated/model.json）を作る。起動・ビルドの前に1回作り、開発中はソースが変わるたびに後ろで作り直す。
 * 作り直すと JSON の import が更新され、開いている画面が新しいモデルを表示する（待たずに保守できる）。
 */
function generateModel(): Plugin {
  let running = false
  let again = false
  const regenerate = () => {
    if (running) {
      again = true
      return
    }
    running = true
    execFile(generator[0], [...generator[1]], { cwd: repositoryRoot }, () => {
      running = false
      if (again) {
        again = false
        regenerate()
      }
    })
  }
  return {
    name: 'generate-model',
    buildStart() {
      // テスト（vitest）は解析の結果を直接使うので、作らない。
      if (process.env['VITEST'] !== undefined) {
        return
      }
      try {
        execFileSync(generator[0], [...generator[1]], { cwd: repositoryRoot, stdio: 'inherit' })
      } catch {
        // 規則の問題があっても、モデルは作られる（ブラウザに問題を出す）。
      }
    },
    configureServer(server) {
      if (process.env['VITEST'] !== undefined) {
        return
      }
      server.watcher.add(watchedDirectories.map((directory) => join(repositoryRoot, directory)))
      server.watcher.on('change', (file) => {
        if (watchedDirectories.some((directory) => file.startsWith(join(repositoryRoot, directory)))) {
          regenerate()
        }
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [generateModel(), react(), tailwindcss()],
  // 画面（pnpm dev:web・pnpm dev:mock の 5173 番）と並べて開けるように、番号を分ける。モックの開発パネルは、ここへリンクする。
  server: { port: 5199 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
})
