import type { Customer } from './entity'

/** 請求先（請求書を受け取り、入金する顧客）かどうか。請求先は自分自身を請求先に持つ。 */
export function isBillingCustomer(customer: Customer): boolean {
  return customer.billingCustomerId === customer.customerId
}

/** 締めの画面で選べる請求先を示すため。 */
export function selectBillingCustomers(customers: readonly Customer[]): readonly Customer[] {
  return customers.filter(isBillingCustomer)
}
