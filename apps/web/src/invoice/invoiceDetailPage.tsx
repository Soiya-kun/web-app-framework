import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useApiClient } from '../shared/apiClient'
import { Button } from '../shared/component/button'
import { FormField, TextInput } from '../shared/component/formField'
import { AlertMessage, PageTitle, Section, StatusMessage } from '../shared/component/page'
import { Cell, HeaderCell, Table } from '../shared/component/table'
import { prepareFormFeedback, readField } from '../shared/formFeedback'
import { useText } from '../shared/text'
import { readTodayText } from '../shared/today'
import { displayYen } from '../shared/yen'
import { deleteClosing, invoiceQueryKey, postIssue, prepareInvoiceDetailQuery } from './invoiceApi'

const invoiceDetailRoute = getRouteApi('/invoices/$invoiceId')

/** 残高を繰り越す請求書の金額の並び（見出しの単語帳の名前と、請求の項目）。 */
const breakdownColumns = [
  { labelName: 'previousInvoiceAmount', field: 'previousAmount' },
  { labelName: 'currentPaymentAmount', field: 'paymentAmount' },
  { labelName: 'adjustmentAmount', field: 'adjustmentAmount' },
  { labelName: 'carriedAmount', field: 'carriedAmount' },
  { labelName: 'currentSalesAmount', field: 'salesAmount' },
  { labelName: 'taxAmount', field: 'taxAmount' },
  { labelName: 'currentInvoiceAmount', field: 'invoiceAmount' },
] as const

const issueFieldLabelNames = { issueDate: 'issueDate' } as const

/** 請求書の中身を出し、発行前なら発行と締めの取消を行う。 */
export function InvoiceDetailPage() {
  const text = useText()
  const apiClient = useApiClient()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { invoiceId } = invoiceDetailRoute.useParams()
  const { data: invoiceDetail } = useSuspenseQuery(prepareInvoiceDetailQuery(apiClient, invoiceId))
  const invoice = invoiceDetail.invoice
  const issueMutation = useMutation({
    mutationFn: (issueDate: string) => postIssue(apiClient, invoiceId, issueDate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invoiceQueryKey }),
  })
  const cancelMutation = useMutation({
    mutationFn: () => deleteClosing(apiClient, invoiceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invoiceQueryKey })
      await navigate({ to: '/invoices' })
    },
  })
  const issueFeedback = prepareFormFeedback(text, issueMutation.error, issueFieldLabelNames)
  const cancelFeedback = prepareFormFeedback(text, cancelMutation.error, {})

  function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    issueMutation.mutate(readField(new FormData(event.currentTarget), 'issueDate'))
  }

  return (
    <>
      <PageTitle>{text.label('invoiceDetail')}</PageTitle>
      <Section>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">{text.label('billingCustomer')}</dt>
            <dd>{invoice.billingCustomerName}</dd>
          </div>
          <div>
            <dt className="text-muted">{text.label('closingDate')}</dt>
            <dd>{invoice.closingDate}</dd>
          </div>
          <div>
            <dt className="text-muted">{text.label('dueDate')}</dt>
            <dd>{invoice.dueDate}</dd>
          </div>
          <div>
            <dt className="text-muted">{text.label('invoiceNumber')}</dt>
            <dd>{invoice.invoiceNumber ?? text.message('unissuedState')}</dd>
          </div>
          <div>
            <dt className="text-muted">{text.label('issueDate')}</dt>
            <dd>{invoice.issueDate ?? '—'}</dd>
          </div>
        </dl>
      </Section>

      <Table caption={text.label('invoiceBreakdown')}>
        <thead>
          <tr>
            {breakdownColumns.map((column) => (
              <HeaderCell key={column.field} align="right">
                {text.label(column.labelName)}
              </HeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {breakdownColumns.map((column) => (
              <Cell key={column.field} align="right">
                {displayYen(text.locale, invoice[column.field])}
              </Cell>
            ))}
          </tr>
        </tbody>
      </Table>

      <Table caption={text.label('taxBreakdown')}>
        <thead>
          <tr>
            <HeaderCell>{text.label('taxRate')}</HeaderCell>
            <HeaderCell align="right">{text.label('taxableAmount')}</HeaderCell>
            <HeaderCell align="right">{text.label('taxAmount')}</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {invoiceDetail.taxes.map((tax) => (
            <tr key={tax.taxRate}>
              <Cell>{`${tax.taxRate}%`}</Cell>
              <Cell align="right">{displayYen(text.locale, tax.taxableAmount)}</Cell>
              <Cell align="right">{displayYen(text.locale, tax.taxAmount)}</Cell>
            </tr>
          ))}
        </tbody>
      </Table>

      <Table caption={text.label('billedSales')}>
        <thead>
          <tr>
            <HeaderCell>{text.label('salesDate')}</HeaderCell>
            <HeaderCell>{text.label('itemName')}</HeaderCell>
            <HeaderCell>{text.label('salesKind')}</HeaderCell>
            <HeaderCell>{text.label('taxRate')}</HeaderCell>
            <HeaderCell align="right">{text.label('salesAmount')}</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {invoiceDetail.sales.map((sales) => (
            <tr key={sales.salesId}>
              <Cell>{sales.salesDate}</Cell>
              <Cell>{sales.itemName}</Cell>
              <Cell>{text.label(sales.salesKind)}</Cell>
              <Cell>{`${sales.taxRate}%`}</Cell>
              <Cell align="right">{displayYen(text.locale, sales.salesAmount)}</Cell>
            </tr>
          ))}
        </tbody>
      </Table>

      <Table caption={text.label('billedPayments')}>
        <thead>
          <tr>
            <HeaderCell>{text.label('date')}</HeaderCell>
            <HeaderCell>{text.label('kind')}</HeaderCell>
            <HeaderCell>{text.label('payerName')}</HeaderCell>
            <HeaderCell align="right">{text.label('amount')}</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {invoiceDetail.payments.map((payment) => (
            <tr key={payment.paymentId}>
              <Cell>{payment.paymentDate}</Cell>
              <Cell>{text.label('payment')}</Cell>
              <Cell>{payment.payerName}</Cell>
              <Cell align="right">{displayYen(text.locale, payment.paymentAmount)}</Cell>
            </tr>
          ))}
          {invoiceDetail.refunds.map((refund) => (
            <tr key={refund.refundId}>
              <Cell>{refund.refundDate}</Cell>
              <Cell>{text.label('refund')}</Cell>
              <Cell>—</Cell>
              <Cell align="right">{displayYen(text.locale, -refund.refundAmount)}</Cell>
            </tr>
          ))}
          {invoiceDetail.adjustments.map((adjustment) => (
            <tr key={adjustment.adjustmentId}>
              <Cell>{adjustment.adjustmentDate}</Cell>
              <Cell>{text.label(adjustment.adjustmentKind)}</Cell>
              <Cell>—</Cell>
              <Cell align="right">{displayYen(text.locale, adjustment.adjustmentAmount)}</Cell>
            </tr>
          ))}
        </tbody>
      </Table>

      {issueMutation.isSuccess ? <StatusMessage>{text.message('issueCompleted')}</StatusMessage> : null}
      {issueFeedback.generalFailure === undefined ? null : <AlertMessage>{issueFeedback.generalFailure}</AlertMessage>}
      {cancelFeedback.generalFailure === undefined ? null : <AlertMessage>{cancelFeedback.generalFailure}</AlertMessage>}

      {invoice.issueDate === null ? (
        <Section>
          <form onSubmit={submitIssue} noValidate className="flex flex-wrap items-end gap-4">
            <FormField field="issueDate" label={text.label('issueDate')} problemText={issueFeedback.describeProblem('issueDate')}>
              <TextInput {...issueFeedback.describeField('issueDate')} inputMode="numeric" defaultValue={readTodayText()} />
            </FormField>
            <Button type="submit" disabled={issueMutation.isPending}>
              {text.label('issue')}
            </Button>
            <Button variant="danger" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
              {text.label('closingCancel')}
            </Button>
          </form>
        </Section>
      ) : null}
    </>
  )
}
