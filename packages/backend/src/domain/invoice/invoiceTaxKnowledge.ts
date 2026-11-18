import type { Sales } from '../sales/entity'
import { taxRates } from '../sales/value/taxRate'
import { sumYen, type Yen } from '../shared/yen'
import type { InvoiceTax } from './entity'
import type { InvoiceId } from './value/invoiceId'

/**
 * 請求の税率ごとの合計と消費税額を求めるため（インボイス制度）。
 * 税抜の売上を税率ごとに合計し、税率をかけて 1円未満を 0 の方へ切り捨てる。売上のない税率は出さない。
 */
export function calculateInvoiceTaxes(invoiceId: InvoiceId, sales: readonly Sales[]): readonly InvoiceTax[] {
  return taxRates.flatMap((taxRate) => {
    const rateSales = sales.filter((item) => item.taxRate === taxRate)
    if (rateSales.length === 0) {
      return []
    }
    const taxableAmount = sumYen(rateSales.map((item) => item.salesAmount))
    const taxAmount = Math.trunc((taxableAmount * taxRate) / 100) as Yen
    return [{ invoiceId, taxRate, taxableAmount, taxAmount }]
  })
}
