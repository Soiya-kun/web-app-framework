import type { Customer } from '../customer/entity'
import type { PayerName } from '../payment/value/payerName'
import type { PayerNameSave } from './payerNameSave'

export type PayerNameRepository = {
  /** その振込依頼人名で覚えた顧客。なければ undefined。 */
  findPayerCustomer(payerName: PayerName): Promise<Customer | undefined>
  savePayerNames(payerNameSaves: readonly PayerNameSave[]): Promise<void>
}
