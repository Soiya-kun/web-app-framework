import type { PaymentRequest } from '@app/backend'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { prepareBillingCustomerListQuery } from '../invoice/invoiceApi'
import { useApiClient } from '../shared/apiClient'
import { Button } from '../shared/component/button'
import { FormField, SelectInput, TextInput } from '../shared/component/formField'
import { AlertMessage, PageTitle, Section, StatusMessage } from '../shared/component/page'
import { prepareFormFeedback, readField } from '../shared/formFeedback'
import { useText } from '../shared/text'
import { paymentQueryKey, postPayment } from './paymentApi'
import { labelKey, type LabelKey } from '@app/vocabulary/text'

type PaymentField = keyof PaymentRequest

const fieldLabelNames = {
  paymentDate: labelKey('paymentDate'),
  paymentMethod: labelKey('paymentMethod'),
  paymentAmount: labelKey('paymentAmount'),
  payerName: labelKey('payerName'),
  customerId: labelKey('customer'),
} as const satisfies Record<PaymentField, LabelKey>

const paymentMethodOptions = ['transfer', 'cash', 'other'] as const

/** 入金を記録する。顧客を選ばなければ、振込依頼人名から自動で特定し、できなければ仮受にする。 */
export function PaymentCreatePage() {
  const text = useText()
  const apiClient = useApiClient()
  const queryClient = useQueryClient()
  const { data: billingCustomers } = useSuspenseQuery(prepareBillingCustomerListQuery(apiClient))
  const paymentMutation = useMutation({
    mutationFn: (paymentRequest: PaymentRequest) => postPayment(apiClient, paymentRequest),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paymentQueryKey }),
  })
  const feedback = prepareFormFeedback(text, paymentMutation.error, fieldLabelNames)
  const registeredCustomer = billingCustomers.find((customer) => customer.customerId === paymentMutation.data?.customerId)

  function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    paymentMutation.mutate({
      paymentDate: readField(formData, 'paymentDate'),
      paymentMethod: readField(formData, 'paymentMethod'),
      paymentAmount: readField(formData, 'paymentAmount'),
      payerName: readField(formData, 'payerName'),
      customerId: readField(formData, 'customerId'),
    })
  }

  return (
    <>
      <PageTitle>{text.label('paymentCreate')}</PageTitle>
      <Section>
        <form onSubmit={submitPayment} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField field="paymentDate" label={text.label('paymentDate')} problemText={feedback.describeProblem('paymentDate')}>
            <TextInput {...feedback.describeField('paymentDate')} inputMode="numeric" placeholder="YYYY-MM-DD" />
          </FormField>
          <FormField field="paymentMethod" label={text.label('paymentMethod')} problemText={feedback.describeProblem('paymentMethod')}>
            <SelectInput {...feedback.describeField('paymentMethod')} defaultValue="transfer">
              {paymentMethodOptions.map((paymentMethod) => (
                <option key={paymentMethod} value={paymentMethod}>
                  {text.label(paymentMethod)}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField field="paymentAmount" label={text.label('paymentAmount')} problemText={feedback.describeProblem('paymentAmount')}>
            <TextInput {...feedback.describeField('paymentAmount')} inputMode="numeric" />
          </FormField>
          <FormField field="payerName" label={text.label('payerName')} problemText={feedback.describeProblem('payerName')}>
            <TextInput {...feedback.describeField('payerName')} />
          </FormField>
          <FormField field="customerId" label={text.label('customer')} problemText={feedback.describeProblem('customerId')}>
            <SelectInput {...feedback.describeField('customerId')} defaultValue="">
              <option value="">{text.message('automaticSelection')}</option>
              {billingCustomers.map((customer) => (
                <option key={customer.customerId} value={customer.customerId}>
                  {customer.customerName}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={paymentMutation.isPending}>
              {text.action('register')}
            </Button>
          </div>
        </form>
      </Section>
      {paymentMutation.isSuccess ? (
        <StatusMessage>
          {registeredCustomer === undefined
            ? text.message('unidentifiedPayment')
            : text.message('paymentIdentified', { customer: registeredCustomer.customerName })}
        </StatusMessage>
      ) : null}
      {feedback.generalFailure === undefined ? null : <AlertMessage>{feedback.generalFailure}</AlertMessage>}
    </>
  )
}
