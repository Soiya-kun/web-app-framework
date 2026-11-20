// 請求を発行するシナリオのケース。請求番号の採番と、発行日の規則を確かめる。
import { confirmScenario, operateScenario } from '@app/flow'
import { describeScenario } from '@app/flow/vitest'
import type { MemoryDatabase } from '@app/backend/testing'
import { expect } from 'vitest'
import { launchApp } from '../../test/launchApp'
import { draftTarget, prepareDraftSeed } from './invoiceSeed'
import { issueInvoice } from './issueInvoice'

/** 4番まで振った年に、発行前の請求を発行する。 */
async function issueOnScreen(issueDate: string, seed: Partial<MemoryDatabase> = {}) {
  const app = await launchApp(prepareDraftSeed({ invoiceCounter: [{ issueYear: 2026, lastNumber: 4 }], ...seed }))
  await operateScenario(issueInvoice, app.screen, { ...draftTarget, issueDate })
  return app
}

describeScenario(issueInvoice, (cases) => {
  cases.main('発行すると、発行日の年の次の請求番号を振り、発行と取消の操作をなくす', async () => {
    const app = await issueOnScreen('2026-11-02')

    await confirmScenario(issueInvoice, app.screen, { ...draftTarget, issueDate: '2026-11-02' })
    await app.screen.expectText('2026-000005')
    expect(app.database.invoice[0]).toMatchObject({ invoiceNumber: '2026-000005', issueDate: '2026-11-02' })
    await app.screen.expectNoButton('issue')
    await app.screen.expectNoButton('closingCancel')
  })

  cases.vary('年が変わると、請求番号は 1 から振る', async () => {
    const app = await issueOnScreen('2027-01-05')

    await app.screen.expectText('2027-000001')
    expect(app.database.invoiceCounter).toEqual([
      { issueYear: 2026, lastNumber: 4 },
      { issueYear: 2027, lastNumber: 1 },
    ])
  })

  cases.extend('earlyIssueDate', '発行せず、請求番号も進めない', async () => {
    const app = await issueOnScreen('2026-10-30')

    await app.screen.expectProblem('issueDate', 'earlyIssueDate', { closingDate: '2026-10-31' })
    expect(app.database.invoice[0]?.invoiceNumber).toBeNull()
    expect(app.database.invoiceCounter).toEqual([{ issueYear: 2026, lastNumber: 4 }])
  })
})
