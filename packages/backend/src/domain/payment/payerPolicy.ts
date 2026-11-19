import { isBillingCustomer } from '../customer/billingKnowledge'
import type { Customer } from '../customer/entity'
import type { CustomerId } from '../customer/value/customerId'
import { ConflictError } from '../shared/error'
import { rejectField } from '../shared/validation'
import type { Payment } from './entity'

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

export function ensurePaymentIdentifiable(payment: Payment, customer: Customer): void {
  if (payment.customerId !== null || payment.invoiceId !== null) {
    throw new ConflictError('identifiedPayment')
  }
  if (!isBillingCustomer(customer)) {
    throw rejectField('customerId', 'billingCustomerRequired')
  }
}
