import type { ClosingRequest } from '@app/backend'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useApiClient } from '../shared/apiClient'
import { Button } from '../shared/component/button'
import { FormField, SelectInput, TextInput } from '../shared/component/formField'
import { AlertMessage, PageTitle, Section } from '../shared/component/page'
import { prepareFormFeedback, readField } from '../shared/formFeedback'
import { useText } from '../shared/text'
import { invoiceQueryKey, postClosing, prepareBillingCustomerListQuery } from './invoiceApi'

type ClosingField = keyof ClosingRequest

const fieldLabelNames = {
  billingCustomerId: 'billingCustomer',
  closingDate: 'closingDate',
} as const satisfies Record<ClosingField, string>

/** 請求先と請求締め日を選び、売上・入金などを前回からの残高を繰り越した請求にまとめる。 */
export function InvoiceClosePage() {
  const text = useText()
  const apiClient = useApiClient()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: billingCustomers } = useSuspenseQuery(prepareBillingCustomerListQuery(apiClient))
  const closingMutation = useMutation({
    mutationFn: (closingRequest: ClosingRequest) => postClosing(apiClient, closingRequest),
    onSuccess: async (invoiceId) => {
      await queryClient.invalidateQueries({ queryKey: invoiceQueryKey })
      await navigate({ to: '/invoices/$invoiceId', params: { invoiceId } })
    },
  })
  const feedback = prepareFormFeedback(text, closingMutation.error, fieldLabelNames)

  function submitClosing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    closingMutation.mutate({
      billingCustomerId: readField(formData, 'billingCustomerId'),
      closingDate: readField(formData, 'closingDate'),
    })
  }

  return (
    <>
      <PageTitle>{text.label('invoiceClosing')}</PageTitle>
      <Section>
        <form onSubmit={submitClosing} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField field="billingCustomerId" label={text.label('billingCustomer')} problemText={feedback.describeProblem('billingCustomerId')}>
            <SelectInput {...feedback.describeField('billingCustomerId')} defaultValue="">
              <option value="">{text.message('selectionPrompt')}</option>
              {billingCustomers.map((customer) => (
                <option key={customer.customerId} value={customer.customerId}>
                  {customer.customerName}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField field="closingDate" label={text.label('closingDate')} problemText={feedback.describeProblem('closingDate')}>
            <TextInput {...feedback.describeField('closingDate')} inputMode="numeric" placeholder="YYYY-MM-DD" />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={closingMutation.isPending}>
              {text.label('close')}
            </Button>
          </div>
        </form>
      </Section>
      {feedback.generalFailure === undefined ? null : <AlertMessage>{feedback.generalFailure}</AlertMessage>}
    </>
  )
}
