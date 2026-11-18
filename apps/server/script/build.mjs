// API サーバーとマイグレーションを、Node でそのまま動く1ファイルずつにまとめる。マイグレーションの SQL も横に置く。
import { cpSync, rmSync } from 'node:fs'
import { build } from 'esbuild'

rmSync('dist', { recursive: true, force: true })
await build({
  entryPoints: ['src/server.ts', 'src/runMigration.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  external: ['pg-native'],
  // まとめた中の CommonJS のパッケージ（pg など）が require を使えるようにする。
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
})
cpSync('../../packages/backend/database/migration', 'dist/migration', { recursive: true })
console.log('dist/server.mjs と dist/runMigration.mjs を作りました。')
