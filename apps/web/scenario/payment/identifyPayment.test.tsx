// 仮受の入金の顧客を特定するシナリオのケース。
import { confirmScenario, operateScenario } from '@app/flow'
import { describeScenario } from '@app/flow/vitest'
import { expect } from 'vitest'
import { customers, preparePayment } from '../../test/billingSeed'
import { launchApp } from '../../test/launchApp'
import { identifyPayment } from './identifyPayment'

describeScenario(identifyPayment, (cases) => {
  cases.main('仮受の入金の行で顧客を選んで特定すると、顧客を入れて振込依頼人名を覚える', async () => {
    const identify = { payerName: 'ヤマダ タロウ', customer: '株式会社親' }
    const app = await launchApp({
      customer: customers,
      payment: [preparePayment('payment-0001', { customerId: null, payerName: 'ヤマダ タロウ' })],
    })
    await operateScenario(identifyPayment, app.screen, identify)

    await confirmScenario(identifyPayment, app.screen, identify)
    await app.screen.row('ヤマダ タロウ').expectText('株式会社親')
    expect(app.database.payment.map((payment) => payment.customerId)).toEqual(['customer-0001'])
    expect(app.database.payerName).toEqual([{ payerName: 'ヤマダ タロウ', customerId: 'customer-0001' }])
  })
})
