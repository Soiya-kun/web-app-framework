import type { Customer } from '../customer/entity'
import type { PayerName } from '../payment/value/payerName'
import type { Brand } from '../shared/brand'
import type { PayerNameEntry } from './entity'

/** 覚える振込依頼人名。同じ名前がすでにあれば、新しい顧客で上書きする。 */
export type PayerNameSave = Brand<PayerNameEntry, 'PayerNameSave'>

/**
 * 顧客を選んで登録・特定した入金の振込依頼人名を、次から自動で特定できるよう覚えるため。
 * 顧客を選んでいなければ（自動で特定した・仮受）覚えるものはない。
 */
export function planPayerNameSaves(payerName: PayerName, selectedCustomer: Customer | undefined): readonly PayerNameSave[] {
  if (selectedCustomer === undefined) {
    return []
  }
  return [{ payerName, customerId: selectedCustomer.customerId } as PayerNameSave]
}
