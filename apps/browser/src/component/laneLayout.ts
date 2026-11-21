// 業務フローのレーン図の配置。担当ごとの横の帯（レーン）に、段を左から順に置く。
// 子フローは、開いたものだけ中の段を並べる（ページのレーン図はすべて開き、キャンバスは押して開く）。
import type { FlowNode, FlowStepNode } from '@app/translator/model-types'
import type { Text } from '@app/vocabulary/text'
import type { ModelTable } from '../model'

export type LaneStep = {
  /** フローの中の番号（子フローの中は 8.2 のように親の番号を付ける）。 */
  readonly number: string
  readonly step: FlowStepNode
  readonly laneKey: string
  readonly laneTitle: string
  readonly pending: boolean
  /** 開いていない子フローの段なら true（押すと開く）。 */
  readonly folded: boolean
}

export type LaneGroup = {
  readonly number: string
  readonly flowId: string
  readonly title: string
  readonly first: number
  readonly last: number
  readonly depth: number
}

export const laneSize = {
  column: 152,
  boxWidth: 132,
  boxHeight: 64,
  lane: 88,
  label: 112,
  margin: 8,
  group: 24,
} as const

export type LaneLayout = {
  readonly steps: readonly LaneStep[]
  readonly groups: readonly LaneGroup[]
  readonly lanes: readonly (readonly [string, string])[]
  readonly top: number
  readonly width: number
  readonly height: number
  measureBoxLeft(index: number): number
  measureBoxTop(laneKey: string): number
}

/** 子フローを開いて（openedNests に入っている番号の子フローだけ）、段を1列に並べる。 */
function expandSteps(
  text: Text,
  table: ModelTable,
  flowTable: ReadonlyMap<string, FlowNode>,
  flow: FlowNode,
  isOpened: (number: string) => boolean,
  prefix: string,
  depth: number,
  steps: LaneStep[],
  groups: LaneGroup[],
): void {
  for (const step of flow.steps) {
    const number = `${prefix}${step.number}`
    const child = step.flowId === null ? undefined : flowTable.get(step.flowId)
    if (step.kind === 'nest' && child !== undefined && depth < 3 && isOpened(number)) {
      const first = steps.length
      expandSteps(text, table, flowTable, child, isOpened, `${number}.`, depth + 1, steps, groups)
      groups.push({ number, flowId: child.id, title: child.title, first, last: steps.length - 1, depth })
      continue
    }
    const laneKey = step.kind === 'elapse' ? 'time' : step.kind === 'nest' ? 'nest' : (step.actor ?? 'unknown')
    const laneTitle =
      step.kind === 'elapse' ? text.label('timeLapse') : step.kind === 'nest' ? text.label('childFlow') : (step.actorTitle ?? '')
    const pending = step.scenarioId !== null && table.scenarios.get(step.scenarioId)?.pending === true
    steps.push({ number, step, laneKey, laneTitle, pending, folded: step.kind === 'nest' })
  }
}

/** レーン図の配置。現行の業務フローなら、子フローを現行の業務フローから引く。 */
export function arrangeLanes(text: Text, table: ModelTable, flow: FlowNode, isOpened: (number: string) => boolean, legacy = false): LaneLayout {
  const steps: LaneStep[] = []
  const groups: LaneGroup[] = []
  expandSteps(text, table, legacy ? table.legacyFlows : table.flows, flow, isOpened, '', 0, steps, groups)
  const lanes = [...new Map(steps.map((step) => [step.laneKey, step.laneTitle])).entries()]
  const laneIndex = new Map(lanes.map(([laneKey], index) => [laneKey, index]))
  const groupDepth = groups.reduce((depth, group) => Math.max(depth, group.depth + 1), 0)
  const top = groupDepth * laneSize.group
  return {
    steps,
    groups,
    lanes,
    top,
    width: laneSize.margin * 2 + steps.length * laneSize.column,
    height: top + lanes.length * laneSize.lane,
    measureBoxLeft: (index) => laneSize.margin + index * laneSize.column + (laneSize.column - laneSize.boxWidth) / 2,
    measureBoxTop: (laneKey) => top + (laneIndex.get(laneKey) ?? 0) * laneSize.lane + (laneSize.lane - laneSize.boxHeight) / 2,
  }
}
