import { prepareApp } from '@app/backend'
import { prepareMemoryDependency, type MemoryDatabase } from '@app/backend/testing'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { PointerEventsCheckLevel, userEvent } from '@testing-library/user-event'
import { prepareApiClient } from '../src/shared/apiClient'
import { AppRoot } from '../src/shared/appRoot'
import { prepareRouter } from '../src/shared/router'

/**
 * 画面を描画し、API の呼び出しを同じプロセスの Hono（handler → usecase → domain → repository）へつなぐ。
 * 通信はしない。差し替えるのは DB（モック DB）だけ。
 * 描画の前に画面の loader を済ませるので、Suspense の待ち（React 19 で約 300ms）が入らない。
 */
export async function renderScreen(path: string, database: MemoryDatabase) {
  const app = prepareApp(prepareMemoryDependency(database))
  const apiClient = prepareApiClient('http://localhost', async (input, options) => app.request(input, options))
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = prepareRouter({ apiClient, queryClient }, createMemoryHistory({ initialEntries: [path] }))
  await router.load()
  // pointer-events の確かめ（祖先の getComputedStyle）は重く、このアプリでは要らないので切る。
  const user = userEvent.setup({ delay: null, pointerEventsCheck: PointerEventsCheckLevel.Never })
  render(<AppRoot apiClient={apiClient} queryClient={queryClient} router={router} locale="ja" />)
  return { user, router }
}
