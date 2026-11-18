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
  salesKind: 'salesKind',
  itemName: 'itemName',
  salesAmount: 'salesAmount',
  taxRate: 'taxRate',
} as const satisfies Record<SalesField, string>

/** 売上区分の選択肢。返品・値引も金額は正で入力し、保存のときに負にする。 */
const salesKindOptions = ['normal', 'return', 'discount'] as const

/** 税率の選択肢（%）。 */
const taxRateOptions = ['10', '8'] as const

function readField(formData: FormData, field: SalesField): string {
  const value = formData.get(field)
  return typeof value === 'string' ? value : ''
}

function FieldRow({ field, problemText, children }: { field: SalesField; problemText: string | undefined; children: ReactNode }) {
  const text = useText()
  return (
    <div>
      <label htmlFor={field}>{text.label(fieldLabelNames[field])}</label>
      {children}
      {problemText === undefined ? null : <p id={`${field}-problem`}>{problemText}</p>}
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
      salesKind: readField(formData, 'salesKind'),
      itemName: readField(formData, 'itemName'),
      salesAmount: readField(formData, 'salesAmount'),
      taxRate: readField(formData, 'taxRate'),
    })
  }

  const failure = salesMutation.error instanceof ApiError ? salesMutation.error.detail : undefined
  function describeProblem(field: SalesField): string | undefined {
    const problem = failure?.problems.find((item) => item.field === field)
    return problem === undefined
      ? undefined
      : text.message(problem.messageKey, { ...problem.params, field: text.label(fieldLabelNames[field]) })
  }
  function describeField(field: SalesField) {
    const problemText = describeProblem(field)
    return {
      id: field,
      name: field,
      'aria-invalid': problemText !== undefined,
      'aria-describedby': problemText === undefined ? undefined : `${field}-problem`,
    }
  }
  const generalFailure = failure !== undefined && failure.problems.length === 0 ? text.message(failure.messageKey, failure.params) : undefined

  return (
    <main>
      <h1>{text.label('salesCreate')}</h1>
      <form onSubmit={submitSales} noValidate>
        <FieldRow field="customerId" problemText={describeProblem('customerId')}>
          <select {...describeField('customerId')} defaultValue="">
            <option value="">{text.message('selectionPrompt')}</option>
            {customers.map((customer) => (
              <option key={customer.customerId} value={customer.customerId}>
                {customer.customerName}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow field="salesDate" problemText={describeProblem('salesDate')}>
          <input {...describeField('salesDate')} type="text" inputMode="numeric" placeholder="YYYY-MM-DD" />
        </FieldRow>
        <FieldRow field="salesKind" problemText={describeProblem('salesKind')}>
          <select {...describeField('salesKind')} defaultValue="normal">
            {salesKindOptions.map((salesKind) => (
              <option key={salesKind} value={salesKind}>
                {text.label(salesKind)}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow field="itemName" problemText={describeProblem('itemName')}>
          <input {...describeField('itemName')} type="text" />
        </FieldRow>
        <FieldRow field="salesAmount" problemText={describeProblem('salesAmount')}>
          <input {...describeField('salesAmount')} type="text" inputMode="numeric" />
        </FieldRow>
        <FieldRow field="taxRate" problemText={describeProblem('taxRate')}>
          <select {...describeField('taxRate')} defaultValue="10">
            {taxRateOptions.map((taxRate) => (
              <option key={taxRate} value={taxRate}>
                {taxRate === '8' ? `8%（${text.label('reduced')}）` : `${taxRate}%`}
              </option>
            ))}
          </select>
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
