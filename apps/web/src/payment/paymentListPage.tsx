import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { prepareBillingCustomerListQuery } from '../invoice/invoiceApi'
import { useApiClient } from '../shared/apiClient'
import { Button } from '../shared/component/button'
import { SelectInput } from '../shared/component/formField'
import { AlertMessage, PageTitle, StatusMessage } from '../shared/component/page'
import { Cell, HeaderCell, Table } from '../shared/component/table'
import { prepareFormFeedback, readField } from '../shared/formFeedback'
import { useText } from '../shared/text'
import { displayYen } from '../shared/yen'
import { paymentQueryKey, postIdentify, preparePaymentListQuery } from './paymentApi'

type IdentifyRequest = { readonly paymentId: string; readonly customerId: string }

/** 入金を新しい入金日から並べる。仮受の入金は、その行で顧客を選んで特定する。 */
export function PaymentListPage() {
  const text = useText()
  const apiClient = useApiClient()
  const queryClient = useQueryClient()
  const { data: payments } = useSuspenseQuery(preparePaymentListQuery(apiClient))
  const { data: billingCustomers } = useSuspenseQuery(prepareBillingCustomerListQuery(apiClient))
  const identifyMutation = useMutation({
    mutationFn: (identifyRequest: IdentifyRequest) => postIdentify(apiClient, identifyRequest.paymentId, identifyRequest.customerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paymentQueryKey }),
  })
  const feedback = prepareFormFeedback(text, identifyMutation.error, { customerId: 'customer' })

  function submitIdentify(event: FormEvent<HTMLFormElement>, paymentId: string) {
    event.preventDefault()
    identifyMutation.mutate({ paymentId, customerId: readField(new FormData(event.currentTarget), 'customerId') })
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <PageTitle>{text.label('paymentList')}</PageTitle>
        <Link to="/payments/new" className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-strong">
          {text.label('paymentCreate')}
        </Link>
      </div>
      {identifyMutation.isSuccess ? <StatusMessage>{text.message('identifyCompleted')}</StatusMessage> : null}
      {feedback.generalFailure === undefined ? null : <AlertMessage>{feedback.generalFailure}</AlertMessage>}
      <Table caption={text.label('paymentList')}>
        <thead>
          <tr>
            <HeaderCell>{text.label('paymentDate')}</HeaderCell>
            <HeaderCell>{text.label('payerName')}</HeaderCell>
            <HeaderCell>{text.label('paymentMethod')}</HeaderCell>
            <HeaderCell align="right">{text.label('paymentAmount')}</HeaderCell>
            <HeaderCell>{text.label('customer')}</HeaderCell>
            <HeaderCell>{text.label('invoice')}</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.paymentId}>
              <Cell>{payment.paymentDate}</Cell>
              <Cell>{payment.payerName}</Cell>
              <Cell>{text.label(payment.paymentMethod)}</Cell>
              <Cell align="right">{displayYen(text.locale, payment.paymentAmount)}</Cell>
              <Cell>
                {payment.customerName ?? (
                  <form onSubmit={(event) => submitIdentify(event, payment.paymentId)} className="flex gap-2">
                    <SelectInput name="customerId" aria-label={text.label('customer')} defaultValue="">
                      <option value="">{text.message('unidentifiedState')}</option>
                      {billingCustomers.map((customer) => (
                        <option key={customer.customerId} value={customer.customerId}>
                          {customer.customerName}
                        </option>
                      ))}
                    </SelectInput>
                    <Button type="submit" variant="secondary" disabled={identifyMutation.isPending}>
                      {text.label('identify')}
                    </Button>
                  </form>
                )}
              </Cell>
              <Cell>{payment.invoiceId === null ? text.label('unbilled') : text.label('billed')}</Cell>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}
