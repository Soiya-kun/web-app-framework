import type { ClosingRequest } from '@app/backend'
import { queryOptions } from '@tanstack/react-query'
import { rejectResponse, type ApiClient } from '../shared/apiClient'

/** 請求のデータのキーの頭。締め・発行・取消のあとに、まとめて取り直す。 */
export const invoiceQueryKey = ['invoice'] as const

export function prepareBillingCustomerListQuery(apiClient: ApiClient) {
  return queryOptions({
    queryKey: ['customer', 'billing'],
    queryFn: async () => {
      const response = await apiClient.api.customers.billing.$get()
      if (!response.ok) {
        return rejectResponse(response)
      }
      const body = await response.json()
      return body.customers
    },
  })
}

export function prepareInvoiceListQuery(apiClient: ApiClient) {
  return queryOptions({
    queryKey: [...invoiceQueryKey, 'list'],
    queryFn: async () => {
      const response = await apiClient.api.invoices.$get()
      if (!response.ok) {
        return rejectResponse(response)
      }
      const body = await response.json()
      return body.invoices
    },
  })
}

export function prepareInvoiceDetailQuery(apiClient: ApiClient, invoiceId: string) {
  return queryOptions({
    queryKey: [...invoiceQueryKey, 'detail', invoiceId],
    queryFn: async () => {
      const response = await apiClient.api.invoices[':invoiceId'].$get({ param: { invoiceId } })
      if (!response.ok) {
        return rejectResponse(response)
      }
      const body = await response.json()
      return body.invoiceDetail
    },
  })
}

export async function postClosing(apiClient: ApiClient, closingRequest: ClosingRequest): Promise<string> {
  const response = await apiClient.api.invoices.$post({ json: closingRequest })
  if (!response.ok) {
    return rejectResponse(response)
  }
  const body = await response.json()
  return body.invoiceId
}

export async function postIssue(apiClient: ApiClient, invoiceId: string, issueDate: string): Promise<string> {
  const response = await apiClient.api.invoices[':invoiceId'].issue.$post({ param: { invoiceId }, json: { issueDate } })
  if (!response.ok) {
    return rejectResponse(response)
  }
  const body = await response.json()
  return body.invoiceNumber
}

export async function deleteClosing(apiClient: ApiClient, invoiceId: string): Promise<void> {
  const response = await apiClient.api.invoices[':invoiceId'].$delete({ param: { invoiceId } })
  if (!response.ok) {
    return rejectResponse(response)
  }
}
