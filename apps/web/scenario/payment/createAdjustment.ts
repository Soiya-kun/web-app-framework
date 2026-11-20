import { defineScenario } from '@app/flow'

// 画面はまだない（未着手）。振込手数料・端数差額・訂正の調整を登録する。調整は次の締めで請求先の残高から減らす（負は増やす）。
export const createAdjustment = defineScenario('createAdjustment', { actor: 'accountant' })
