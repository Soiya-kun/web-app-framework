import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, createRoute, createRouter, Outlet, type RouterHistory } from '@tanstack/react-router'
import { Suspense } from 'react'
import { prepareCustomerListQuery } from '../sales/salesApi'
import { SalesCreatePage } from '../sales/salesCreatePage'
import type { ApiClient } from './apiClient'
import { useText } from './text'

/** loader が使う部品。画面を開く前に、表示に要るデータを取得しておく。 */
export type RouterContext = {
  readonly apiClient: ApiClient
  readonly queryClient: QueryClient
}

function RootLayout() {
  const text = useText()
  return (
    <Suspense fallback={<p>{text.message('loading')}</p>}>
      <Outlet />
    </Suspense>
  )
}

/** 画面の道筋（URL と画面の対応）を組み立てる。テストでは history にメモリ上の履歴を渡す。 */
export function prepareRouter(routerContext: RouterContext, history?: RouterHistory) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({ component: RootLayout })
  const salesCreateRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sales/new',
    loader: ({ context }) => context.queryClient.ensureQueryData(prepareCustomerListQuery(context.apiClient)),
    component: SalesCreatePage,
  })
  const routeTree = rootRoute.addChildren([salesCreateRoute])
  return createRouter(
    history === undefined ? { routeTree, context: routerContext } : { routeTree, context: routerContext, history },
  )
}

export type AppRouter = ReturnType<typeof prepareRouter>
