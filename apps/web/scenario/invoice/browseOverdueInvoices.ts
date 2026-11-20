import { defineScenario } from '@app/flow'

// 画面はまだない（未着手）。入金期日を過ぎても入金がない請求を、次の請求の繰越額と入金期日から求めて一覧にする。
export const browseOverdueInvoices = defineScenario('browseOverdueInvoices', { actor: 'accountant' })
