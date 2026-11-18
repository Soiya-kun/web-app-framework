import type { Brand } from '../../shared/brand'

/** 請求番号（2026-000001 の形）。発行した年ごとに、欠番なく1から振る。 */
export type InvoiceNumber = Brand<string, 'InvoiceNumber'>

/** 発行した年と、その年の通し番号から、請求番号を作るため。 */
export function composeInvoiceNumber(issueYear: number, lastNumber: number): InvoiceNumber {
  return `${issueYear}-${String(lastNumber).padStart(6, '0')}` as InvoiceNumber
}
