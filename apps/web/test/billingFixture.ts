// 請求の画面の結合テストで使う顧客と行。
import type { Customer, Invoice, Payment, Sales, Stored } from '@app/backend/testing'

/** 親会社。末締め翌月末払い。子会社の請求先でもある。 */
export const parentCustomer: Stored<Customer> = {
  customerId: 'customer-0001',
  customerName: '株式会社親',
  billingCustomerId: 'customer-0001',
  closingDay: 31,
  collectionMonthOffset: 1,
  collectionDay: 31,
}

/** 子会社。請求先は親会社。 */
export const childCustomer: Stored<Customer> = {
  customerId: 'customer-0002',
  customerName: '株式会社子',
  billingCustomerId: 'customer-0001',
  closingDay: 31,
  collectionMonthOffset: 1,
  collectionDay: 31,
}

/** 20日締め翌月10日払いの請求先。 */
export const twentiethCustomer: Stored<Customer> = {
  customerId: 'customer-0003',
  customerName: '株式会社二十日',
  billingCustomerId: 'customer-0003',
  closingDay: 20,
  collectionMonthOffset: 1,
  collectionDay: 10,
}

export const customers = [parentCustomer, childCustomer, twentiethCustomer]

/** 売上の行を作る。指定のない項目は、親会社の通常の売上（10%）にする。 */
export function prepareSales(salesId: string, values: Partial<Stored<Sales>>): Stored<Sales> {
  return {
    salesId,
    customerId: 'customer-0001',
    salesDate: '2026-10-15',
    salesKind: 'normal',
    itemName: '運賃',
    salesAmount: 10_000,
    taxRate: 10,
    invoiceId: null,
    ...values,
  }
}

/** 入金の行を作る。指定のない項目は、親会社からの振込にする。 */
export function preparePayment(paymentId: string, values: Partial<Stored<Payment>>): Stored<Payment> {
  return {
    paymentId,
    paymentDate: '2026-11-10',
    paymentMethod: 'transfer',
    paymentAmount: 10_000,
    payerName: 'カ）オヤ',
    customerId: 'customer-0001',
    invoiceId: null,
    ...values,
  }
}

/** 発行済みの10月の請求（今回請求額 126,200 円）。 */
export const issuedOctoberInvoice: Stored<Invoice> = {
  invoiceId: 'invoice-1001',
  billingCustomerId: 'customer-0001',
  previousInvoiceId: null,
  closingDate: '2026-10-31',
  dueDate: '2026-11-30',
  previousAmount: 0,
  paymentAmount: 0,
  adjustmentAmount: 0,
  carriedAmount: 0,
  salesAmount: 115_000,
  taxAmount: 11_200,
  invoiceAmount: 126_200,
  invoiceNumber: '2026-000001',
  issueDate: '2026-11-02',
}
