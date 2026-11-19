import type { Brand } from '../../shared/brand'
import type { IdGenerator } from '../../shared/idGenerator'

/** 売上を1件に決める ID。 */
export type SalesId = Brand<string, 'SalesId'>

export function assignSalesId(idGenerator: IdGenerator): SalesId {
  return idGenerator.generate() as SalesId
}
