import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, createRoute, createRouter, Link, Outlet, redirect, type RouterHistory } from '@tanstack/react-router'
import { Suspense } from 'react'
import { prepareBillingCustomerListQuery, prepareInvoiceDetailQuery, prepareInvoiceListQuery } from '../invoice/invoiceApi'
import { InvoiceClosePage } from '../invoice/invoiceClosePage'
import { InvoiceDetailPage } from '../invoice/invoiceDetailPage'
import { InvoiceListPage } from '../invoice/invoiceListPage'
import { prepareCustomerListQuery } from '../sales/salesApi'
import { SalesCreatePage } from '../sales/salesCreatePage'
import type { ApiClient } from './apiClient'
import { useText } from './text'

/** loader が使う部品。画面を開く前に、表示に要るデータを取得しておく（Suspense の待ちを入れない）。 */
export type RouterContext = {
  readonly apiClient: ApiClient
  readonly queryClient: QueryClient
}

const navigationLinks = [
  { path: '/sales/new', labelName: 'salesCreate' },
  { path: '/invoices/close', labelName: 'invoiceClosing' },
  { path: '/invoices', labelName: 'invoiceList' },
] as const

function RootLayout() {
  const text = useText()
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <nav className="mx-auto flex max-w-5xl gap-6 px-4 py-3 text-sm">
          {navigationLinks.map((navigationLink) => (
            <Link
              key={navigationLink.path}
              to={navigationLink.path}
              activeOptions={{ exact: true }}
              className="text-muted hover:text-ink [&.active]:font-bold [&.active]:text-ink"
            >
              {text.label(navigationLink.labelName)}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <Suspense fallback={<p>{text.message('loading')}</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: RootLayout })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/invoices' })
  },
})

const salesCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sales/new',
  loader: ({ context }) => context.queryClient.ensureQueryData(prepareCustomerListQuery(context.apiClient)),
  component: SalesCreatePage,
})

const invoiceListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invoices',
  loader: ({ context }) => context.queryClient.ensureQueryData(prepareInvoiceListQuery(context.apiClient)),
  component: InvoiceListPage,
})

const invoiceCloseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invoices/close',
  loader: ({ context }) => context.queryClient.ensureQueryData(prepareBillingCustomerListQuery(context.apiClient)),
  component: InvoiceClosePage,
})

const invoiceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invoices/$invoiceId',
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(prepareInvoiceDetailQuery(context.apiClient, params.invoiceId)),
  component: InvoiceDetailPage,
})

const routeTree = rootRoute.addChildren([indexRoute, salesCreateRoute, invoiceListRoute, invoiceCloseRoute, invoiceDetailRoute])

/** 画面の道筋（URL と画面の対応）を組み立てる。テストでは history にメモリ上の履歴を渡す。 */
export function prepareRouter(routerContext: RouterContext, history?: RouterHistory) {
  return createRouter(
    history === undefined ? { routeTree, context: routerContext } : { routeTree, context: routerContext, history },
  )
}

export type AppRouter = ReturnType<typeof prepareRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
