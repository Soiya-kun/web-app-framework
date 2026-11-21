// 見積（apps/web/estimate の defineEstimate）と機能ごとの工数（apps/web/effort の defineEffort）を読む。
// いちばん新しい見積で、どの項目からも指されていないシナリオを「未見積のシナリオ」として数える（見積は任意なので、止めない）。
// 工数は、いちばん新しい見積の項目のうち、対象をいちばん直接に指している項目に割り当てる。
import ts from 'typescript'
import { readPlace, type PlaceTables } from './meetingModel'
import { lineOf, listExportedCalls, readProperty, readString, unwrap, type SourceReader } from './source'
import type { EffortNode, EstimateItemNode, EstimateNode, FlowNode, FlowStepNode, MeetingPlaceNode, ModelProblem, ScenarioNode } from './types'

export const estimateRoot = 'apps/web/estimate'
export const effortRoot = 'apps/web/effort'

const datePattern = /^\d{4}-\d{2}-\d{2}$/

/** 金額のリテラル（1_000・負の値も読む）。 */
function readAmount(node: ts.Expression | undefined): number | undefined {
  const inner = node === undefined ? undefined : unwrap(node)
  if (inner !== undefined && ts.isNumericLiteral(inner)) {
    return Number(inner.text.replace(/_/g, ''))
  }
  if (inner !== undefined && ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(inner.operand)) {
    return -Number(inner.operand.text.replace(/_/g, ''))
  }
  return undefined
}

export function readEstimates(reader: SourceReader, tables: PlaceTables, problems: ModelProblem[]): EstimateNode[] {
  const estimates = reader.list(estimateRoot, (path) => path.endsWith('.ts') && !path.endsWith('.test.ts')).flatMap((file) => {
    const parsed = reader.read(file)
    return listExportedCalls(parsed, 'defineEstimate').flatMap(({ name: variable, call }): EstimateNode[] => {
      const place = { file, line: lineOf(parsed, call) }
      const date = readString(call.arguments[0]) ?? ''
      if (!datePattern.test(date) || variable !== `estimate${date.replace(/-/g, '')}`) {
        problems.push({ ...place, rule: 'estimate', message: `見積の日付「${date}」は YYYY-MM-DD にし、変数の名前を estimate と日付（estimate${date.replace(/-/g, '')}）にする` })
      }
      const options = call.arguments[1]
      if (options === undefined || !ts.isObjectLiteralExpression(options)) {
        problems.push({ ...place, rule: 'estimate', message: '見積の2つめの引数は { title, items } にする' })
        return []
      }
      const itemsNode = readProperty(options, 'items')
      const items = (itemsNode !== undefined && ts.isArrayLiteralExpression(unwrap(itemsNode)) ? (unwrap(itemsNode) as ts.ArrayLiteralExpression).elements : []).flatMap(
        (element): EstimateItemNode[] => {
          const item = unwrap(element)
          const itemPlace = { file, line: lineOf(parsed, element) }
          const title = ts.isObjectLiteralExpression(item) ? readString(readProperty(item, 'title')) : undefined
          const amount = ts.isObjectLiteralExpression(item) ? readAmount(readProperty(item, 'amount')) : undefined
          if (!ts.isObjectLiteralExpression(item) || title === undefined || title === '' || amount === undefined) {
            problems.push({ ...itemPlace, rule: 'estimate-item', message: '見積の項目は { title: 項目の名前, amount: 金額（円の数）, targets: [対象] } にする' })
            return []
          }
          const targetsNode = readProperty(item, 'targets')
          const targetNodes = targetsNode !== undefined && ts.isArrayLiteralExpression(unwrap(targetsNode)) ? (unwrap(targetsNode) as ts.ArrayLiteralExpression).elements : []
          const targets = targetNodes.flatMap((node): MeetingPlaceNode[] => {
            const resolved = readPlace(parsed, node, tables)
            if (resolved === undefined) {
              problems.push({ ...itemPlace, rule: 'estimate-item', message: '見積の項目の対象は、業務フロー・シナリオ・extensionOf(シナリオ, 拡張)・画面の部品・処理・現行の業務フローなどを、ファイルから import して指す' })
              return []
            }
            return [resolved]
          })
          return [{ title, amount, targets, audit: null, manual: null }]
        },
      )
      return [
        {
          id: variable,
          date,
          title: readString(readProperty(options, 'title')) ?? variable,
          rate: readAmount(readProperty(options, 'rate')) ?? null,
          items,
          totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
          ...place,
        },
      ]
    })
  })
  return estimates.sort((left, right) => left.date.localeCompare(right.date))
}

/** 業務フローの段（子フローと拡張の段を含む）にあるシナリオ。 */
function listFlowScenarios(flowId: string, flows: ReadonlyMap<string, FlowNode>, seen = new Set<string>()): string[] {
  const flow = flows.get(flowId)
  if (flow === undefined || seen.has(flowId)) {
    return []
  }
  seen.add(flowId)
  const readSteps = (steps: readonly FlowStepNode[]): string[] =>
    steps.flatMap((step) => [
      ...(step.scenarioId === null ? [] : [step.scenarioId]),
      ...(step.kind === 'nest' && step.flowId !== null ? listFlowScenarios(step.flowId, flows, seen) : []),
      ...step.extensions.flatMap((extension) => readSteps(extension.then)),
    ])
  return readSteps(flow.steps)
}

/** 対象の並びのどれにも当たらないシナリオ。業務フローの対象はその中のシナリオに、画面・処理の対象はそれを開く・通るシナリオに当たる。 */
function listUncoveredScenarios(targets: readonly MeetingPlaceNode[], scenarios: readonly ScenarioNode[], flows: readonly FlowNode[]): string[] {
  const flowTable = new Map(flows.map((flow) => [flow.id, flow]))
  const coveredByFlow = new Set(targets.flatMap((target) => (target.kind === 'flow' ? listFlowScenarios(target.id, flowTable) : [])))
  return scenarios
    .filter(
      (scenario) =>
        !coveredByFlow.has(scenario.id) &&
        !targets.some(
          (target) =>
            ((target.kind === 'scenario' || target.kind === 'extension') && target.id === scenario.id) ||
            (target.kind === 'page' && scenario.pageIds.includes(target.id)) ||
            (target.kind === 'work' && scenario.workIds.includes(target.id)),
        ),
    )
    .map((scenario) => scenario.id)
}

/** いちばん新しい見積で、どの項目からも指されていないシナリオ。見積がなければ空。 */
export function listUnestimatedScenarios(estimates: readonly EstimateNode[], scenarios: readonly ScenarioNode[], flows: readonly FlowNode[]): string[] {
  const latest = estimates.at(-1)
  return latest === undefined ? [] : listUncoveredScenarios(latest.items.flatMap((item) => item.targets), scenarios, flows)
}

/** 工数を書いていないシナリオ。工数がひとつもなければ空。 */
export function listMissingEffortScenarios(efforts: readonly EffortNode[], scenarios: readonly ScenarioNode[], flows: readonly FlowNode[]): string[] {
  return efforts.length === 0 ? [] : listUncoveredScenarios(efforts.map((effort) => effort.target), scenarios, flows)
}

function isSamePlace(left: MeetingPlaceNode, right: MeetingPlaceNode): boolean {
  return left.kind === right.kind && left.id === right.id && left.extension === right.extension
}

/** 機能ごとの工数（apps/web/effort の defineEffort）を読む。 */
export function readEfforts(reader: SourceReader, tables: PlaceTables, problems: ModelProblem[]): Omit<EffortNode, 'itemIndex'>[] {
  const efforts: Omit<EffortNode, 'itemIndex'>[] = []
  for (const file of reader.list(effortRoot, (path) => path.endsWith('.ts') && !path.endsWith('.test.ts'))) {
    const parsed = reader.read(file)
    for (const { call } of listExportedCalls(parsed, 'defineEffort')) {
      const itemsNode = call.arguments[0] === undefined ? undefined : unwrap(call.arguments[0])
      for (const element of itemsNode !== undefined && ts.isArrayLiteralExpression(itemsNode) ? itemsNode.elements : []) {
        const item = unwrap(element)
        const place = { file, line: lineOf(parsed, element) }
        const targetNode = ts.isObjectLiteralExpression(item) ? readProperty(item, 'target') : undefined
        const target = targetNode === undefined ? undefined : readPlace(parsed, targetNode, tables)
        const audit = ts.isObjectLiteralExpression(item) ? readAmount(readProperty(item, 'audit')) : undefined
        const manual = ts.isObjectLiteralExpression(item) ? readAmount(readProperty(item, 'manual')) : undefined
        if (target === undefined || audit === undefined || manual === undefined || audit < 0 || manual < 0) {
          problems.push({ ...place, rule: 'effort', message: '工数は { target: 対象を import した値, audit: 監査の人日, manual: 人がコーディングとテストをする場合の人日 } にする（人日は 0 以上の数）' })
          continue
        }
        if (efforts.some((effort) => isSamePlace(effort.target, target))) {
          problems.push({ ...place, rule: 'effort', message: `「${target.title}」の工数を2つ書いている（1つの対象に1つにする）` })
          continue
        }
        efforts.push({ target, audit, manual, ...place })
      }
    }
  }
  return efforts
}

/**
 * 工数を、いちばん新しい見積の項目に割り当てる。対象をいちばん直接に指している項目にする
 * （同じ対象 > 業務フローの中のシナリオ > シナリオが開く画面・通る処理）。同じ強さなら前の項目。
 */
export function allocateEfforts(
  estimates: readonly EstimateNode[],
  efforts: readonly Omit<EffortNode, 'itemIndex'>[],
  scenarios: readonly ScenarioNode[],
  flows: readonly FlowNode[],
): { readonly estimates: EstimateNode[]; readonly efforts: EffortNode[] } {
  const latest = estimates.at(-1)
  if (latest === undefined) {
    return { estimates: [...estimates], efforts: efforts.map((effort) => ({ ...effort, itemIndex: null })) }
  }
  const flowTable = new Map(flows.map((flow) => [flow.id, flow]))
  const scenarioTable = new Map(scenarios.map((scenario) => [scenario.id, scenario]))
  const strengthOf = (itemTarget: MeetingPlaceNode, target: MeetingPlaceNode): number => {
    if (isSamePlace(itemTarget, target)) {
      return 3
    }
    const isScenario = target.kind === 'scenario' || target.kind === 'extension'
    if (itemTarget.kind === 'flow' && isScenario && listFlowScenarios(itemTarget.id, flowTable).includes(target.id)) {
      return 2
    }
    const scenario = itemTarget.kind === 'scenario' ? scenarioTable.get(itemTarget.id) : undefined
    return scenario !== undefined && ((target.kind === 'page' && scenario.pageIds.includes(target.id)) || (target.kind === 'work' && scenario.workIds.includes(target.id))) ? 1 : 0
  }
  const allocated = efforts.map((effort): EffortNode => {
    const strengths = latest.items.map((item) => Math.max(0, ...item.targets.map((itemTarget) => strengthOf(itemTarget, effort.target))))
    const best = Math.max(0, ...strengths)
    return { ...effort, itemIndex: best === 0 ? null : strengths.indexOf(best) }
  })
  const sum = (index: number, key: 'audit' | 'manual') =>
    allocated.filter((effort) => effort.itemIndex === index).reduce((total, effort) => total + effort[key], 0)
  const items = latest.items.map((item, index) => ({ ...item, audit: sum(index, 'audit'), manual: sum(index, 'manual') }))
  return { estimates: [...estimates.slice(0, -1), { ...latest, items }], efforts: allocated }
}
