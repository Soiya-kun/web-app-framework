import type { Customer } from '../customer/entity'
import type { Brand } from '../shared/brand'
import type { Sales } from './entity'
import type { SalesInput } from './salesRequest'
import type { SalesAmount } from './value/salesAmount'
import type { SalesId } from './value/salesId'

/** 売上の登録で保存する値。この型の項目が、そのまま sales テーブルの1行になる（invoice_id は締めで入れる）。 */
export type SalesCreate = Brand<Omit<Sales, 'invoiceId'>, 'SalesCreate'>

export function planSalesCreate(salesId: SalesId, customer: Customer, salesInput: SalesInput): SalesCreate {
  const salesAmount = salesInput.salesKind === 'normal' ? salesInput.salesAmount : (-salesInput.salesAmount as SalesAmount)
  return {
    salesId,
    customerId: customer.customerId,
    salesDate: salesInput.salesDate,
    salesKind: salesInput.salesKind,
    itemName: salesInput.itemName,
    salesAmount,
    taxRate: salesInput.taxRate,
  } as SalesCreate
}
