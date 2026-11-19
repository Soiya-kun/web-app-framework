import type { Brand } from '../../shared/brand'
import type { IdGenerator } from '../../shared/idGenerator'
import { rejectValue } from '../../shared/validation'

/** 請求を1件に決める ID。 */
export type InvoiceId = Brand<string, 'InvoiceId'>

export function assignInvoiceId(idGenerator: IdGenerator): InvoiceId {
  return idGenerator.generate() as InvoiceId
}

export function interpretInvoiceId(text: string): InvoiceId {
  if (text === '') {
    throw rejectValue('inputRequired')
  }
  return text as InvoiceId
}
