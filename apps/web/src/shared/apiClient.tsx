import type { AppType, ErrorResponse } from '@app/backend'
import { hc } from 'hono/client'
import { createContext, use, type ReactNode } from 'react'

export type ApiClient = ReturnType<typeof hc<AppType>>

/** API を呼ぶ口。本番は HTTP で、画面の結合テストは fetch を差し替えて同じプロセスの Hono を呼ぶ。 */
export function prepareApiClient(baseUrl: string, fetchFunction?: typeof fetch): ApiClient {
  return hc<AppType>(baseUrl, fetchFunction === undefined ? {} : { fetch: fetchFunction })
}

/** API がエラーを返したことを表す。画面は issues から項目ごとの文を出す。 */
export class ApiError extends Error {
  readonly detail: ErrorResponse['error']

  constructor(detail: ErrorResponse['error']) {
    super(detail.messageKey)
    this.detail = detail
  }
}

/** 失敗した応答を ApiError にして投げる。 */
export async function rejectResponse(response: Response): Promise<never> {
  const body = (await response.json()) as ErrorResponse
  throw new ApiError(body.error)
}

const ApiClientContext = createContext<ApiClient | undefined>(undefined)

export function ApiClientProvider({ apiClient, children }: { apiClient: ApiClient; children: ReactNode }) {
  return <ApiClientContext value={apiClient}>{children}</ApiClientContext>
}

export function useApiClient(): ApiClient {
  const apiClient = use(ApiClientContext)
  if (apiClient === undefined) {
    throw new Error('ApiClientProvider の中で使ってください。')
  }
  return apiClient
}
