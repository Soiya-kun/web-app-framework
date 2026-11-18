import type { SalesRequest } from '@app/backend'
import { queryOptions } from '@tanstack/react-query'
import { rejectResponse, type ApiClient } from '../shared/apiClient'

export function prepareCustomerListQuery(apiClient: ApiClient) {
  return queryOptions({
    queryKey: ['customer', 'list'],
    queryFn: async () => {
      const response = await apiClient.api.customers.$get()
      if (!response.ok) {
        return rejectResponse(response)
      }
      const body = await response.json()
      return body.customers
    },
  })
}

export async function postSales(apiClient: ApiClient, salesRequest: SalesRequest): Promise<string> {
  const response = await apiClient.api.sales.$post({ json: salesRequest })
  if (!response.ok) {
    return rejectResponse(response)
  }
  const body = await response.json()
  return body.salesId
}
