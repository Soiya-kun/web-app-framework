import type { SalesRequest } from '@app/backend'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useApiClient } from '../shared/apiClient'
import { Button } from '../shared/component/button'
import { FormField, SelectInput, TextInput } from '../shared/component/formField'
import { AlertMessage, PageTitle, Section, StatusMessage } from '../shared/component/page'
import { prepareFormFeedback, readField } from '../shared/formFeedback'
import { useText } from '../shared/text'
import { postSales, prepareCustomerListQuery } from './salesApi'

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

export function SalesCreatePage() {
  const text = useText()
  const apiClient = useApiClient()
  const { data: customers } = useSuspenseQuery(prepareCustomerListQuery(apiClient))
  const salesMutation = useMutation({
    mutationFn: (salesRequest: SalesRequest) => postSales(apiClient, salesRequest),
  })
  const feedback = prepareFormFeedback(text, salesMutation.error, fieldLabelNames)

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

  return (
    <>
      <PageTitle>{text.label('salesCreate')}</PageTitle>
      <Section>
        <form onSubmit={submitSales} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField field="customerId" label={text.label('customer')} problemText={feedback.describeProblem('customerId')}>
            <SelectInput {...feedback.describeField('customerId')} defaultValue="">
              <option value="">{text.message('selectionPrompt')}</option>
              {customers.map((customer) => (
                <option key={customer.customerId} value={customer.customerId}>
                  {customer.customerName}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField field="salesDate" label={text.label('salesDate')} problemText={feedback.describeProblem('salesDate')}>
            <TextInput {...feedback.describeField('salesDate')} inputMode="numeric" placeholder="YYYY-MM-DD" />
          </FormField>
          <FormField field="salesKind" label={text.label('salesKind')} problemText={feedback.describeProblem('salesKind')}>
            <SelectInput {...feedback.describeField('salesKind')} defaultValue="normal">
              {salesKindOptions.map((salesKind) => (
                <option key={salesKind} value={salesKind}>
                  {text.label(salesKind)}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField field="itemName" label={text.label('itemName')} problemText={feedback.describeProblem('itemName')}>
            <TextInput {...feedback.describeField('itemName')} />
          </FormField>
          <FormField field="salesAmount" label={text.label('salesAmount')} problemText={feedback.describeProblem('salesAmount')}>
            <TextInput {...feedback.describeField('salesAmount')} inputMode="numeric" />
          </FormField>
          <FormField field="taxRate" label={text.label('taxRate')} problemText={feedback.describeProblem('taxRate')}>
            <SelectInput {...feedback.describeField('taxRate')} defaultValue="10">
              {taxRateOptions.map((taxRate) => (
                <option key={taxRate} value={taxRate}>
                  {taxRate === '8' ? `8%（${text.label('reduced')}）` : `${taxRate}%`}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={salesMutation.isPending}>
              {text.label('create')}
            </Button>
          </div>
        </form>
      </Section>
      {salesMutation.isSuccess ? <StatusMessage>{text.message('createCompleted')}</StatusMessage> : null}
      {feedback.generalFailure === undefined ? null : <AlertMessage>{feedback.generalFailure}</AlertMessage>}
    </>
  )
}
