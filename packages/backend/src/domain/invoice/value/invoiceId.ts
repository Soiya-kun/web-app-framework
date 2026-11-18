import type { Brand } from '../../shared/brand'
import type { IdGenerator } from '../../shared/idGenerator'
import { rejectValue } from '../../shared/validation'

/** 請求を1件に決める ID。 */
export type InvoiceId = Brand<string, 'InvoiceId'>

/** 新しい請求に ID を割り当てるため。 */
export function assignInvoiceId(idGenerator: IdGenerator): InvoiceId {
  return idGenerator.generate() as InvoiceId
}

/** 画面の URL などから届いた請求の ID を受け付けるため。 */
export function interpretInvoiceId(text: string): InvoiceId {
  if (text === '') {
    throw rejectValue('inputRequired')
  }
  return text as InvoiceId
}
