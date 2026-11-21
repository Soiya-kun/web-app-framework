// 見積（apps/web/estimate の defineEstimate）を読む。項目の名前と金額と、指している対象（業務フロー・シナリオ・画面・処理・現行の業務フロー）。
// いちばん新しい見積で、どの項目からも指されていないシナリオを「見積にないシナリオ」として数える（見積は任意なので、止めない）。
import ts from 'typescript'
import { readPlace, type PlaceTables } from './meetingModel'
import { lineOf, listExportedCalls, readProperty, readString, unwrap, type SourceReader } from './source'
import type { EstimateItemNode, EstimateNode, FlowNode, FlowStepNode, MeetingPlaceNode, ModelProblem, ScenarioNode } from './types'

export const estimateRoot = 'apps/web/estimate'

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
          return [{ title, amount, targets }]
        },
      )
      return [
        {
          id: variable,
          date,
          title: readString(readProperty(options, 'title')) ?? variable,
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

/** いちばん新しい見積で、どの項目からも指されていないシナリオ。見積がなければ空。 */
export function listUnestimatedScenarios(estimates: readonly EstimateNode[], scenarios: readonly ScenarioNode[], flows: readonly FlowNode[]): string[] {
  const latest = estimates.at(-1)
  if (latest === undefined) {
    return []
  }
  const flowTable = new Map(flows.map((flow) => [flow.id, flow]))
  const targets = latest.items.flatMap((item) => item.targets)
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
