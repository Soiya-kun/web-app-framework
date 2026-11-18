import type { CustomerId } from '../customer/value/customerId'
import type { InvoiceId } from '../invoice/value/invoiceId'
import type { PaymentId } from '../payment/value/paymentId'
import type { Stored } from '../shared/brand'
import type { Yen } from '../shared/yen'
import type { AdjustmentDate } from './value/adjustmentDate'
import type { AdjustmentId } from './value/adjustmentId'
import type { AdjustmentKind } from './value/adjustmentKind'

/** 請求先の残高を、入金でなく当社の判断で減らす（正）・増やす（負）こと。項目は adjustment テーブルの列と同じ。 */
export type Adjustment = {
  readonly adjustmentId: AdjustmentId
  readonly billingCustomerId: CustomerId
  readonly adjustmentDate: AdjustmentDate
  readonly adjustmentKind: AdjustmentKind
  readonly adjustmentAmount: Yen
  readonly paymentId: PaymentId | null
  readonly invoiceId: InvoiceId | null
}

/** 保存済みの値から調整を組み立てるため。保存済みの値は DB の制約で検証済みとして扱う。 */
export function restoreAdjustment(stored: Stored<Adjustment>): Adjustment {
  return stored as Adjustment
}
