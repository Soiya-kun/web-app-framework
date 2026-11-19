import { isBillingCustomer } from '../customer/billingKnowledge'
import type { Customer } from '../customer/entity'
import type { CustomerId } from '../customer/value/customerId'
import { ConflictError } from '../shared/error'
import { rejectField } from '../shared/validation'
import type { Payment } from './entity'

/**
 * 入金の顧客を決めるため。画面で選んだ顧客を優先し、選んでいなければ振込依頼人名で覚えた顧客にする。
 * どちらもなければ null（振込人を特定できていない入金＝仮受）にする。入金を受けるのは請求先だけ。
 */
export function decidePaymentCustomer(
  selectedCustomer: Customer | undefined,
  payerCustomer: Customer | undefined,
): CustomerId | null {
  if (selectedCustomer !== undefined) {
    if (!isBillingCustomer(selectedCustomer)) {
      throw rejectField('customerId', 'billingCustomerRequired')
    }
    return selectedCustomer.customerId
  }
  return payerCustomer?.customerId ?? null
}

/** 仮受の入金の顧客を特定してよいかを確かめるため。仮受のままで、まだ請求に載せておらず、相手が請求先であること。 */
export function ensurePaymentIdentifiable(payment: Payment, customer: Customer): void {
  if (payment.customerId !== null || payment.invoiceId !== null) {
    throw new ConflictError('identifiedPayment')
  }
  if (!isBillingCustomer(customer)) {
    throw rejectField('customerId', 'billingCustomerRequired')
  }
}
