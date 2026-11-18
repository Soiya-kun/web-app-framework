import type { CustomerId } from '../customer/value/customerId'
import type { SalesAmount } from './value/salesAmount'
import type { SalesDate } from './value/salesDate'
import type { SalesId } from './value/salesId'

/** 顧客に対して計上した売上。 */
export type Sales = {
  readonly salesId: SalesId
  readonly customerId: CustomerId
  readonly salesDate: SalesDate
  readonly salesAmount: SalesAmount
}

/** 保存済みの値から売上を組み立てるため。保存済みの値は検証済みとして扱う。 */
export function restoreSales(salesId: string, customerId: string, salesDate: string, salesAmount: number): Sales {
  return {
    salesId: salesId as SalesId,
    customerId: customerId as CustomerId,
    salesDate: salesDate as SalesDate,
    salesAmount: salesAmount as SalesAmount,
  }
}
