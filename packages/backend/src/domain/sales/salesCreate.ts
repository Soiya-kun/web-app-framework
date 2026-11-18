import type { Customer } from '../customer/entity'
import type { CustomerId } from '../customer/value/customerId'
import type { Brand } from '../shared/brand'
import type { SalesAmount } from './value/salesAmount'
import type { SalesDate } from './value/salesDate'
import type { SalesId } from './value/salesId'

/** 売上の登録で保存する値。この型の項目が、そのまま sales テーブルの1行になる。 */
export type SalesCreate = Brand<
  {
    readonly salesId: SalesId
    readonly customerId: CustomerId
    readonly salesDate: SalesDate
    readonly salesAmount: SalesAmount
  },
  'SalesCreate'
>

/** 検証済みの入力と確かめた顧客から、保存する売上を決めるため。 */
export function planSalesCreate(
  salesId: SalesId,
  customer: Customer,
  salesDate: SalesDate,
  salesAmount: SalesAmount,
): SalesCreate {
  return { salesId, customerId: customer.customerId, salesDate, salesAmount } as SalesCreate
}
