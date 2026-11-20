import { defineScenario } from '@app/flow'

// 画面はまだない（未着手）。過入金・他社宛の誤入金を振込人へ返すとき、返金を登録する。返金は次の締めで今回入金額から差し引く。
export const createRefund = defineScenario('createRefund', { actor: 'accountant' })
