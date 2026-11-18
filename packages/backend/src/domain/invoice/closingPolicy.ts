import type { Customer } from '../customer/entity'
import { isBillingCustomer } from '../customer/billingKnowledge'
import { isEarlierDate, placeMonthDay, splitDate } from '../shared/calendar'
import { ConflictError } from '../shared/error'
import { rejectField } from '../shared/validation'
import type { ClosingInput } from './closingRequest'
import type { Invoice } from './entity'
import type { ClosingDate } from './value/closingDate'

/** 請求締め日が、請求先の締日（31 は月末。その月にない日も月末）に合うかどうか。 */
export function isClosingDayOf(customer: Customer, closingDate: ClosingDate): boolean {
  const closingParts = splitDate(closingDate)
  return placeMonthDay(closingParts.year, closingParts.month, customer.closingDay) === closingDate
}

/**
 * 締めてよいかを確かめるため。
 * 請求先であること、締め日が請求先の締日に合うこと、前回の請求が発行済みで、締め日が前回より後であること。
 */
export function ensureClosable(billingCustomer: Customer, latestInvoice: Invoice | undefined, closingInput: ClosingInput): void {
  if (!isBillingCustomer(billingCustomer)) {
    throw rejectField('billingCustomerId', 'billingCustomerRequired')
  }
  if (!isClosingDayOf(billingCustomer, closingInput.closingDate)) {
    throw billingCustomer.closingDay === 31
      ? rejectField('closingDate', 'monthEndRequired')
      : rejectField('closingDate', 'closingDayRequired', { closingDay: billingCustomer.closingDay })
  }
  if (latestInvoice === undefined) {
    return
  }
  if (latestInvoice.issueDate === null) {
    throw new ConflictError('unissuedInvoice')
  }
  if (!isEarlierDate(latestInvoice.closingDate, closingInput.closingDate)) {
    throw rejectField('closingDate', 'earlyClosingDate', { previousDate: latestInvoice.closingDate })
  }
}
