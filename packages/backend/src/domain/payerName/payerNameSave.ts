import type { Customer } from '../customer/entity'
import type { PayerName } from '../payment/value/payerName'
import type { Brand } from '../shared/brand'
import type { PayerNameEntry } from './entity'

/** 覚える振込依頼人名。同じ名前がすでにあれば、新しい顧客で上書きする。 */
export type PayerNameSave = Brand<PayerNameEntry, 'PayerNameSave'>

export function planPayerNameSaves(payerName: PayerName, selectedCustomer: Customer | undefined): readonly PayerNameSave[] {
  if (selectedCustomer === undefined) {
    return []
  }
  return [{ payerName, customerId: selectedCustomer.customerId } as PayerNameSave]
}
