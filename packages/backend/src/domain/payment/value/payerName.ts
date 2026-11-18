import type { Brand } from '../../shared/brand'

/** 振込依頼人名（銀行の明細に出る名前）。顧客の名前と違うことがある。 */
export type PayerName = Brand<string, 'PayerName'>
