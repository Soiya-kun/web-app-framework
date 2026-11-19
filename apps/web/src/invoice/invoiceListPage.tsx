import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useApiClient } from '../shared/apiClient'
import { PageTitle } from '../shared/component/page'
import { Cell, HeaderCell, Table } from '../shared/component/table'
import { useText } from '../shared/text'
import { displayYen } from '../shared/yen'
import { prepareInvoiceListQuery } from './invoiceApi'

/** 締めた請求を、新しい締め日から並べる。 */
export function InvoiceListPage() {
  const text = useText()
  const apiClient = useApiClient()
  const { data: invoices } = useSuspenseQuery(prepareInvoiceListQuery(apiClient))

  return (
    <>
      <div className="flex items-center justify-between">
        <PageTitle>{text.label('invoiceList')}</PageTitle>
        <Link to="/invoices/close" className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-strong">
          {text.label('invoiceClosing')}
        </Link>
      </div>
      <Table caption={text.label('invoiceList')}>
        <thead>
          <tr>
            <HeaderCell>{text.label('closingDate')}</HeaderCell>
            <HeaderCell>{text.label('billingCustomer')}</HeaderCell>
            <HeaderCell>{text.label('dueDate')}</HeaderCell>
            <HeaderCell align="right">{text.label('currentInvoiceAmount')}</HeaderCell>
            <HeaderCell>{text.label('invoiceNumber')}</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.invoiceId}>
              <Cell>
                <Link to="/invoices/$invoiceId" params={{ invoiceId: invoice.invoiceId }} className="text-primary underline">
                  {invoice.closingDate}
                </Link>
              </Cell>
              <Cell>{invoice.billingCustomerName}</Cell>
              <Cell>{invoice.dueDate}</Cell>
              <Cell align="right">{displayYen(text.locale, invoice.invoiceAmount)}</Cell>
              <Cell>{invoice.invoiceNumber ?? text.label('unissued')}</Cell>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}
