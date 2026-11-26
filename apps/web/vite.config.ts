import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 開発のときは /api を手元の API サーバー（pnpm dev:api）へ中継する。本番は CloudFront が振り分ける。
    proxy: { '/api': process.env['API_ORIGIN'] ?? 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // 画面のテストは、シナリオのケース（scenario）と業務フローの E2E（flow）にだけ書く。
    include: ['scenario/**/*.test.tsx', 'flow/**/*.test.tsx', 'transition/**/*.test.tsx'],
  },
})
