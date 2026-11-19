import type { Locale } from '@app/vocabulary/text'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { ApiClientProvider, type ApiClient } from './apiClient'
import type { AppRouter } from './router'
import { TextProvider } from './text'

export type AppRootProps = {
  readonly apiClient: ApiClient
  readonly queryClient: QueryClient
  readonly router: AppRouter
  readonly locale: Locale
}

/** 画面全体の土台。本番とテストで、ここに渡す部品だけを変える。 */
export function AppRoot({ apiClient, queryClient, router, locale }: AppRootProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider apiClient={apiClient}>
        <TextProvider locale={locale}>
          <RouterProvider router={router} />
        </TextProvider>
      </ApiClientProvider>
    </QueryClientProvider>
  )
}
