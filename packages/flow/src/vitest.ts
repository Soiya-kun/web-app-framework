// シナリオのケースと業務フローを、vitest のテストとして登録する。
// テストの名前は単語帳から日本語にする（registerPayment →「入金を記録する」）。中身のないケースは todo（未着手）にする。
import { renderNounPhrase, translateStep } from '@app/vocabulary'
import { describe, test, vi } from 'vitest'
import type { Flow, Scenario } from './definition'
import { listFlowPaths, runFlowPath } from './path'
import type { Screen } from './screen'

type CaseRun = () => Promise<void>

export type ScenarioCases<ExtensionName extends string> = {
  /** 主成功シナリオ。シナリオに1つだけ書く。 */
  main(title: string, run?: CaseRun): void
  /** 技術とデータのバリエーション（うまくいく範囲での入力の違い）。 */
  vary(title: string, run?: CaseRun): void
  /** 拡張（シナリオに書いた条件）。 */
  extend(extension: ExtensionName, title: string, run?: CaseRun): void
  varyEach<Row extends object>(rows: readonly Row[], title: string, run: (row: Row) => Promise<void>): void
  extendEach<Row extends object>(extension: ExtensionName, rows: readonly Row[], title: string, run: (row: Row) => Promise<void>): void
}

function register(title: string, run: CaseRun | undefined): void {
  if (run === undefined) {
    test.todo(title)
    return
  }
  test(title, run)
}

/** シナリオのケースを書く。 */
export function describeScenario<Input, ExtensionName extends string>(
  scenario: Scenario<Input, ExtensionName>,
  body: (cases: ScenarioCases<ExtensionName>) => void,
): void {
  const conditionOf = (extension: ExtensionName) => scenario.extensions[extension].condition
  describe(`シナリオ: ${translateStep(scenario.name)}`, () => {
    body({
      main: (title, run) => register(`主成功シナリオ: ${title}`, run),
      vary: (title, run) => register(`バリエーション: ${title}`, run),
      extend: (extension, title, run) => register(`拡張「${conditionOf(extension)}」: ${title}`, run),
      varyEach: (rows, title, run) => test.each(rows)(`バリエーション: ${title}`, run),
      extendEach: (extension, rows, title, run) => test.each(rows)(`拡張「${conditionOf(extension)}」: ${title}`, run),
    })
  })
}

export type FlowApp = {
  readonly screen: Screen
  /**
   * 今日の日付を変える（時の経過の段）。実ブラウザではブラウザの時計を変える。
   * 渡さなければ、同じプロセスの Date を差し替える（インプロセスのテスト）。
   */
  readonly setToday?: (date: string) => Promise<void>
  /** 経路を流し終えたら、ブラウザなどを閉じる。 */
  readonly close?: () => Promise<void>
}

/** 業務フローを、経路（本線と拡張）ごとの E2E として流す。未着手のシナリオに来たら、そこまで流して skip にする。 */
export function describeFlow<Seed>(flow: Flow<Seed>, startApp: (seed: Seed | undefined) => Promise<FlowApp>): void {
  describe(`業務フロー: ${renderNounPhrase(flow.name, 'ja')}`, () => {
    for (const path of listFlowPaths(flow as Flow<unknown>)) {
      test(path.title, async (context) => {
        const app = await startApp(flow.precondition?.seed)
        const setToday = app.setToday
        if (setToday === undefined) {
          vi.useFakeTimers({ toFake: ['Date'] })
        }
        try {
          const result = await runFlowPath(path, app.screen, async (date) => {
            if (setToday === undefined) {
              vi.setSystemTime(new Date(`${date}T09:00:00+09:00`))
              return
            }
            await setToday(date)
          })
          if (result.pendingAt !== undefined) {
            context.skip(`未着手のシナリオ: ${result.pendingAt}`)
          }
        } finally {
          if (setToday === undefined) {
            vi.useRealTimers()
          }
          await app.close?.()
        }
      })
    }
  })
}
