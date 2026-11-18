import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom は scrollTo を持たない。ルーターがページの移動時に呼ぶので、何もしない関数にしておく。
window.scrollTo = () => undefined

afterEach(() => {
  cleanup()
})
