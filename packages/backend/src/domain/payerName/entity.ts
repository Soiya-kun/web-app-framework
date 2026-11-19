import type { CustomerId } from '../customer/value/customerId'
import type { PayerName } from '../payment/value/payerName'

/** 振込依頼人名と、その名前で振り込む請求先の対応。項目は payer_name テーブルの列と同じ。 */
export type PayerNameEntry = {
  readonly payerName: PayerName
  readonly customerId: CustomerId
}
