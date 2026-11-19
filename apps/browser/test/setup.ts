import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

window.scrollTo = () => undefined

afterEach(() => {
  cleanup()
  // キャンバスの状態はブラウザに保存されるので、テストごとに消す。
  window.localStorage.clear()
})
