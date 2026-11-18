import type { SalesRequest } from '@app/backend'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import type { FormEvent, ReactNode } from 'react'
import { ApiError, useApiClient } from '../shared/apiClient'
import { useText } from '../shared/text'
import { prepareCustomerListQuery, postSales } from './salesApi'

type SalesField = keyof SalesRequest

/** 項目ごとの見出しに使う単語帳の名前。 */
const fieldLabelNames = {
  customerId: 'customer',
  salesDate: 'salesDate',
  salesAmount: 'salesAmount',
} as const satisfies Record<SalesField, string>

function readField(formData: FormData, field: SalesField): string {
  const value = formData.get(field)
  return typeof value === 'string' ? value : ''
}

function FieldRow({ field, issueText, children }: { field: SalesField; issueText: string | undefined; children: ReactNode }) {
  const text = useText()
  return (
    <div>
      <label htmlFor={field}>{text.label(fieldLabelNames[field])}</label>
      {children}
      {issueText === undefined ? null : <p id={`${field}-issue`}>{issueText}</p>}
    </div>
  )
}

export function SalesCreatePage() {
  const text = useText()
  const apiClient = useApiClient()
  const { data: customers } = useSuspenseQuery(prepareCustomerListQuery(apiClient))
  const salesMutation = useMutation({
    mutationFn: (salesRequest: SalesRequest) => postSales(apiClient, salesRequest),
  })

  function submitSales(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    salesMutation.mutate({
      customerId: readField(formData, 'customerId'),
      salesDate: readField(formData, 'salesDate'),
      salesAmount: readField(formData, 'salesAmount'),
    })
  }

  const failure = salesMutation.error instanceof ApiError ? salesMutation.error.detail : undefined
  function describeIssue(field: SalesField): string | undefined {
    const issue = failure?.issues.find((item) => item.field === field)
    return issue === undefined
      ? undefined
      : text.message(issue.messageKey, { ...issue.params, field: text.label(fieldLabelNames[field]) })
  }
  function describeField(field: SalesField) {
    const issueText = describeIssue(field)
    return {
      id: field,
      name: field,
      'aria-invalid': issueText !== undefined,
      'aria-describedby': issueText === undefined ? undefined : `${field}-issue`,
    }
  }
  const generalFailure = failure !== undefined && failure.issues.length === 0 ? text.message(failure.messageKey, failure.params) : undefined

  return (
    <main>
      <h1>{text.label('salesCreate')}</h1>
      <form onSubmit={submitSales} noValidate>
        <FieldRow field="customerId" issueText={describeIssue('customerId')}>
          <select {...describeField('customerId')} defaultValue="">
            <option value="">{text.message('selectionPrompt')}</option>
            {customers.map((customer) => (
              <option key={customer.customerId} value={customer.customerId}>
                {customer.customerName}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow field="salesDate" issueText={describeIssue('salesDate')}>
          <input {...describeField('salesDate')} type="text" inputMode="numeric" placeholder="YYYY-MM-DD" />
        </FieldRow>
        <FieldRow field="salesAmount" issueText={describeIssue('salesAmount')}>
          <input {...describeField('salesAmount')} type="text" inputMode="numeric" />
        </FieldRow>
        <button type="submit" disabled={salesMutation.isPending}>
          {text.label('create')}
        </button>
      </form>
      {salesMutation.isSuccess ? <p role="status">{text.message('createCompleted')}</p> : null}
      {generalFailure === undefined ? null : <p role="alert">{generalFailure}</p>}
    </main>
  )
}
