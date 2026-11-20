// 入金を記録するシナリオのケース。振込依頼人名による顧客の特定・仮受と、入力の境界を確かめる。
import { confirmExtension, confirmScenario, operateScenario } from '@app/flow'
import { describeScenario } from '@app/flow/vitest'
import type { MemoryDatabase } from '@app/backend/testing'
import { expect } from 'vitest'
import { customers } from '../../test/billingSeed'
import { launchApp } from '../../test/launchApp'
import { registerPayment, type PaymentInput } from './registerPayment'

const validPayment: PaymentInput = { paymentDate: '2026-11-10', paymentAmount: '50000', payerName: 'ｶ)ｵﾔ', customer: '株式会社親' }

/** 画面を開いて入金を記録する。 */
async function registerOnScreen(payment: PaymentInput, seed: Partial<MemoryDatabase> = {}) {
  const app = await launchApp({ customer: customers, ...seed })
  await operateScenario(registerPayment, app.screen, payment)
  return app
}

describeScenario(registerPayment, (cases) => {
  cases.main('顧客を選んで記録すると、その顧客の入金にし、振込依頼人名を半角・全角の違いをそろえて覚える', async () => {
    const app = await registerOnScreen(validPayment)

    await confirmScenario(registerPayment, app.screen, validPayment)
    expect(app.database.payment).toEqual([
      {
        paymentId: 'id-0001',
        paymentDate: '2026-11-10',
        paymentMethod: 'transfer',
        paymentAmount: 50_000,
        payerName: 'カ)オヤ',
        customerId: 'customer-0001',
        invoiceId: null,
      },
    ])
    expect(app.database.payerName).toEqual([{ payerName: 'カ)オヤ', customerId: 'customer-0001' }])
  })

  cases.vary('顧客を選ばなければ、覚えた振込依頼人名から顧客を特定する', async () => {
    const app = await registerOnScreen(
      { ...validPayment, payerName: 'カ）オヤ', customer: '' },
      { payerName: [{ payerName: 'カ)オヤ', customerId: 'customer-0001' }] },
    )

    await confirmScenario(registerPayment, app.screen, validPayment)
    expect(app.database.payment.map((row) => row.customerId)).toEqual(['customer-0001'])
  })

  cases.varyEach(
    [
      { paymentAmount: '1', savedAmount: 1 },
      { paymentAmount: '999999999', savedAmount: 999_999_999 },
    ],
    '入金額「$paymentAmount」は記録する',
    async ({ paymentAmount, savedAmount }) => {
      const app = await registerOnScreen({ ...validPayment, paymentAmount })

      await confirmScenario(registerPayment, app.screen, validPayment)
      expect(app.database.payment.map((row) => row.paymentAmount)).toEqual([savedAmount])
    },
  )

  cases.extend('unidentifiedPayer', '仮受として記録し、振込依頼人名は覚えない', async () => {
    const payment = { ...validPayment, payerName: 'ヤマダ　　タロウ', customer: '' }
    const app = await registerOnScreen(payment)

    await confirmExtension(registerPayment, 'unidentifiedPayer', app.screen, payment)
    expect(app.database.payment.map((row) => [row.payerName, row.customerId])).toEqual([['ヤマダ タロウ', null]])
    expect(app.database.payerName).toEqual([])
  })

  cases.extend('mistakenPayment', '他社宛の誤入金も、画面では仮受として記録する（返金するまで請求に載せない）', async () => {
    const payment = { ...validPayment, payerName: 'カ)タシャ', customer: '' }
    const app = await registerOnScreen(payment)

    await confirmExtension(registerPayment, 'mistakenPayment', app.screen, payment)
    expect(app.database.payment.map((row) => [row.payerName, row.customerId, row.invoiceId])).toEqual([['カ)タシャ', null, null]])
    expect(app.database.payerName).toEqual([])
  })

  cases.extendEach(
    'invalidPaymentAmount',
    [
      { paymentAmount: '0', messageKey: 'invalidRange' },
      { paymentAmount: '1000000000', messageKey: 'invalidRange' },
      { paymentAmount: 'abc', messageKey: 'integerRequired' },
      { paymentAmount: '', messageKey: 'inputRequired' },
    ] as const,
    '入金額「$paymentAmount」は「$messageKey」で止める',
    async ({ paymentAmount, messageKey }) => {
      const app = await registerOnScreen({ ...validPayment, paymentAmount })

      await app.screen.expectProblem('paymentAmount', messageKey, { minimum: 1, maximum: 999_999_999 })
      expect(app.database.payment).toEqual([])
    },
  )

  cases.extendEach(
    'invalidPayerName',
    [
      { payerName: 'ア'.repeat(101), messageKey: 'longText' },
      { payerName: '', messageKey: 'inputRequired' },
    ] as const,
    '振込依頼人名「$payerName」は「$messageKey」で止める',
    async ({ payerName, messageKey }) => {
      const app = await registerOnScreen({ ...validPayment, payerName })

      await app.screen.expectProblem('payerName', messageKey, { maximum: 100 })
    },
  )

  cases.extend('invalidPaymentDate', '実在しない入金日は止める', async () => {
    const app = await registerOnScreen({ ...validPayment, paymentDate: '2026-11-31' })

    await app.screen.expectProblem('paymentDate', 'invalidDate')
  })
})
