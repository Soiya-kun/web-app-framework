// 業務フローを、テストで流す経路に展開する。本線が1つと、拡張ごとに1つ。
// 段の番号は「4」「4.2」（子フローの中）、拡張は「8a」のように振る（コーバーンのユースケースの書き方）。
import type { Flow, FlowStep, Scenario, ScenarioStep } from './definition'

export type PathAction =
  | {
      readonly kind: 'operate'
      readonly number: string
      readonly scenario: Scenario<unknown, string>
      readonly input: unknown
      readonly confirm: ScenarioStep<unknown> | undefined
    }
  | { readonly kind: 'elapse'; readonly number: string; readonly date: string }
  | { readonly kind: 'note'; readonly number: string; readonly step: FlowStep }

export type FlowPath = {
  /** main か、拡張の番号（8a など）。 */
  readonly key: string
  readonly title: string
  readonly actions: readonly PathAction[]
}

type NumberedStep = { readonly number: string; readonly step: FlowStep }

/** 段に番号を振り、子フローを中に展開する。 */
export function numberSteps(steps: readonly FlowStep[], prefix = ''): NumberedStep[] {
  return steps.flatMap((step, index) => {
    const number = `${prefix}${index + 1}`
    if (step.kind === 'nest') {
      return [{ number, step }, ...numberSteps(step.flow.steps, `${number}.`)]
    }
    return [{ number, step }]
  })
}

function toActions(numbered: readonly NumberedStep[]): PathAction[] {
  return numbered.flatMap(({ number, step }): PathAction[] => {
    if (step.kind === 'operate') {
      return [{ kind: 'operate', number, scenario: step.scenario, input: step.input, confirm: step.scenario.confirm }]
    }
    if (step.kind === 'elapse') {
      return [{ kind: 'elapse', number, date: step.date }]
    }
    if (step.kind === 'nest') {
      return []
    }
    return [{ kind: 'note', number, step }]
  })
}

const extensionLetters = 'abcdefghijklmnopqrstuvwxyz'

/** 本線と、拡張ごとの経路。拡張の経路は、その段の代わりに拡張の段を流し、本線の次の段へ戻る。 */
export function listFlowPaths(flow: Flow<unknown>): FlowPath[] {
  const numbered = numberSteps(flow.steps)
  const paths: FlowPath[] = [{ key: 'main', title: '本線', actions: toActions(numbered) }]
  numbered.forEach(({ number, step }, position) => {
    if (step.kind !== 'operate') {
      return
    }
    step.extensions.forEach((extension, extensionIndex) => {
      const key = `${number}${extensionLetters[extensionIndex] ?? String(extensionIndex)}`
      const replaced: PathAction = {
        kind: 'operate',
        number: key,
        scenario: extension.scenario,
        input: extension.input,
        confirm: extension.scenario.extensions[extension.name]?.confirm,
      }
      paths.push({
        key,
        title: `${key}. ${extension.condition}`,
        actions: [
          ...toActions(numbered.slice(0, position)),
          replaced,
          ...toActions(numberSteps(extension.then, `${key}.`)),
          ...(extension.resume ? toActions(numbered.slice(position + 1)) : []),
        ],
      })
    })
  })
  return paths
}

/** 経路を流す。未着手のシナリオに来たら、そこで止めてその名前を返す。 */
export async function runFlowPath(
  path: FlowPath,
  screen: Parameters<ScenarioStep<unknown>>[0],
  setToday: (date: string) => void,
): Promise<{ readonly pendingAt: string | undefined }> {
  for (const action of path.actions) {
    if (action.kind === 'elapse') {
      setToday(action.date)
    }
    if (action.kind === 'operate') {
      if (action.scenario.operate === undefined) {
        return { pendingAt: `${action.number}. ${action.scenario.name}` }
      }
      await action.scenario.operate(screen, action.input)
      if (action.confirm !== undefined) {
        await action.confirm(screen, action.input)
      }
    }
  }
  return { pendingAt: undefined }
}
