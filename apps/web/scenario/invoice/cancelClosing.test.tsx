// 締めを取り消すシナリオのケース。
import { confirmScenario, operateScenario } from '@app/flow'
import { describeScenario } from '@app/flow/vitest'
import { expect } from 'vitest'
import { launchApp } from '../../test/launchApp'
import { cancelClosing } from './cancelClosing'
import { draftTarget, prepareDraftSeed } from './invoiceFixture'

describeScenario(cancelClosing, (cases) => {
  cases.main('請求を消し、載せた行を請求に載せる前へ戻して一覧へ移る', async () => {
    const app = await launchApp(prepareDraftSeed())
    await operateScenario(cancelClosing, app.screen, draftTarget)

    await confirmScenario(cancelClosing, app.screen, draftTarget)
    expect(app.database.invoice).toEqual([])
    expect(app.database.invoiceTax).toEqual([])
    expect([
      ...app.database.sales.map((row) => row.invoiceId),
      ...app.database.payment.map((row) => row.invoiceId),
      ...app.database.refund.map((row) => row.invoiceId),
      ...app.database.adjustment.map((row) => row.invoiceId),
    ]).toEqual([null, null, null, null])
  })
})
