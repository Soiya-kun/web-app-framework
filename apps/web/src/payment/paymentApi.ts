import type { PaymentRequest } from '@app/backend'
import { queryOptions } from '@tanstack/react-query'
import { rejectResponse, type ApiClient } from '../shared/apiClient'

/** 入金のデータのキーの頭。登録・特定のあとに、まとめて取り直す。 */
export const paymentQueryKey = ['payment'] as const

export function preparePaymentListQuery(apiClient: ApiClient) {
  return queryOptions({
    queryKey: [...paymentQueryKey, 'list'],
    queryFn: async () => {
      const response = await apiClient.api.payments.$get()
      if (!response.ok) {
        return rejectResponse(response)
      }
      const body = await response.json()
      return body.payments
    },
  })
}

export async function postPayment(apiClient: ApiClient, paymentRequest: PaymentRequest) {
  const response = await apiClient.api.payments.$post({ json: paymentRequest })
  if (!response.ok) {
    return rejectResponse(response)
  }
  return response.json()
}

export async function postIdentify(apiClient: ApiClient, paymentId: string, customerId: string): Promise<void> {
  const response = await apiClient.api.payments[':paymentId'].identify.$post({ param: { paymentId }, json: { customerId } })
  if (!response.ok) {
    return rejectResponse(response)
  }
}
