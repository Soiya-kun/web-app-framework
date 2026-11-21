import { defineScenario } from '@app/flow'
import { accountant } from '../../role/role'

// 画面はまだない（未着手）。取引を始める顧客を、請求先・締日・回収条件とともに登録する。
export const createCustomer = defineScenario('createCustomer', { actor: accountant })
