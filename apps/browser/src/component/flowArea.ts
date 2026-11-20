// 業務フローを、業務の領域（apps/web/flow/<領域>/）ごとにまとめる。キャンバス・レイヤー・一覧で同じ並びにする。
import type { FlowNode, FlowStepNode, ScenarioNode } from '@app/translator/model-types'

export type FlowArea = {
  readonly id: string
  readonly title: string
  readonly flows: readonly FlowNode[]
}

function sumSteps(steps: readonly FlowStepNode[]): number {
  return steps.reduce((total, step) => total + 1 + step.extensions.reduce((sum, extension) => sum + sumSteps(extension.then), 0), 0)
}

/**
 * 領域ごとにまとめる。子フローを持つ業務フロー（全体を見渡す業務フロー）のある領域を先にし、残りは業務フローの多い順。
 * 領域の中は、最上位の業務フローを段の多い順に並べ、子フローを後にする。
 */
export function arrangeFlowAreas(flows: readonly FlowNode[]): FlowArea[] {
  const areaIds = [...new Set(flows.map((flow) => flow.area))]
  const hasParentFlow = (areaId: string) => flows.some((flow) => flow.area === areaId && flows.some((child) => child.parentIds.includes(flow.id)))
  const areas = areaIds.map((areaId) => {
    const areaFlows = flows.filter((flow) => flow.area === areaId)
    const topFlows = areaFlows.filter((flow) => flow.parentIds.length === 0).sort((left, right) => sumSteps(right.steps) - sumSteps(left.steps))
    return {
      id: areaId,
      title: areaFlows[0]?.areaTitle ?? areaId,
      flows: [...topFlows, ...areaFlows.filter((flow) => flow.parentIds.length > 0)],
    }
  })
  return areas.sort(
    (left, right) =>
      Number(hasParentFlow(right.id)) - Number(hasParentFlow(left.id)) || right.flows.length - left.flows.length || left.id.localeCompare(right.id),
  )
}

/** 業務フローの段（拡張の中の段を含む）のうち、未着手のシナリオの段の数。 */
export function sumPendingSteps(flow: FlowNode, scenarios: ReadonlyMap<string, ScenarioNode>): number {
  const sumPending = (steps: readonly FlowStepNode[]): number =>
    steps.reduce(
      (total, step) =>
        total +
        (step.scenarioId !== null && scenarios.get(step.scenarioId)?.pending === true ? 1 : 0) +
        step.extensions.reduce((sum, extension) => sum + sumPending(extension.then), 0),
      0,
    )
  return sumPending(flow.steps)
}
