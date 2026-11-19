import { rejectValue } from '../../shared/validation'

/** 入金方法。transfer は銀行振込。 */
export const paymentMethods = ['transfer', 'cash', 'other'] as const

export type PaymentMethod = (typeof paymentMethods)[number]

export function interpretPaymentMethod(text: string): PaymentMethod {
  const paymentMethod = paymentMethods.find((method) => method === text)
  if (paymentMethod === undefined) {
    throw rejectValue('selectionRequired')
  }
  return paymentMethod
}
