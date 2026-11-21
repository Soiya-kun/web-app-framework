// 現行（AsIs）の業務フローを、置き換え先の新しい業務フロー（ToBe）と比べる。
// 同じ値の段は「同じ」、置き換え先のある段は「置き換え」、どちらでもない段は「廃止」。
// 新しい業務フローの段のうち、現行のどの段からも指されていないものは「新しい」段として並べる。
import type { AddedStepNode, FlowNode, FlowStepNode, LegacyFlowNode, LegacyTableNode, ModelProblem, StepChange, TableNode } from './types'

type FlatStep = { readonly number: string; readonly step: FlowStepNode }

/** 子フローを開いて、段を1列に並べる（番号は 8.2 のように親の番号を付ける）。open が false の子フローは開かない。 */
function flattenSteps(flow: FlowNode, flows: ReadonlyMap<string, FlowNode>, open: (step: FlowStepNode) => boolean, prefix = '', depth = 0): FlatStep[] {
  return flow.steps.flatMap((step) => {
    const number = `${prefix}${step.number}`
    const child = step.flowId === null ? undefined : flows.get(step.flowId)
    return step.kind === 'nest' && child !== undefined && depth < 5 && open(step) ? flattenSteps(child, flows, open, `${number}.`, depth + 1) : [{ number, step }]
  })
}

/** 新しい業務フローの段を、現行の段と照らし合わせる鍵（シナリオ・段の値・時の経過・業務フロー）。 */
function keyOf(step: FlowStepNode): string | null {
  if (step.scenarioId !== null) {
    return `scenario:${step.scenarioId}`
  }
  return step.kind === 'nest' && step.flowId !== null ? `flow:${step.flowId}` : step.stepKey
}

function replacementKeyOf(replacement: FlowStepNode['replacements'][number]): string {
  return replacement.kind === 'step' ? replacement.id : `${replacement.kind}:${replacement.id}`
}

export function compareLegacyFlows(
  legacyFlows: readonly (FlowNode & { readonly replacementIds: readonly string[] })[],
  flows: readonly FlowNode[],
): { readonly legacyFlows: LegacyFlowNode[]; readonly flows: FlowNode[] } {
  const flowTable = new Map(flows.map((flow) => [flow.id, flow]))
  const legacyTable = new Map<string, FlowNode>(legacyFlows.map((flow) => [flow.id, flow]))
  const compared = legacyFlows.map((legacy): LegacyFlowNode => {
    const legacySteps = flattenSteps(legacy, legacyTable, () => true).map(({ step }) => step)
    const matchedKeys = new Set(legacySteps.flatMap((step) => [...(step.stepKey === null ? [] : [step.stepKey]), ...step.replacements.map(replacementKeyOf)]))
    // 置き換え先の業務フローの段（置き換え先として指した子フローは、まとめて1つの段として見る）。
    const futureSteps = legacy.replacementIds.flatMap((flowId) => {
      const flow = flowTable.get(flowId)
      return flow === undefined ? [] : flattenSteps(flow, flowTable, (step) => !matchedKeys.has(`flow:${step.flowId ?? ''}`))
    })
    const futureKeys = new Set(futureSteps.flatMap(({ step }) => (keyOf(step) === null ? [] : [keyOf(step) ?? ''])))
    const changeOf = (step: FlowStepNode): StepChange | null => {
      if (step.kind === 'nest') {
        return null
      }
      if (step.stepKey !== null && futureKeys.has(step.stepKey)) {
        return 'same'
      }
      return step.replacements.length > 0 ? 'replaced' : 'discontinued'
    }
    const addedSteps: AddedStepNode[] = futureSteps
      .filter(({ step }) => !matchedKeys.has(keyOf(step) ?? ''))
      .map(({ number, step }) => ({ number, kind: step.kind, title: step.title, scenarioId: step.scenarioId }))
    return { ...legacy, steps: legacy.steps.map((step) => ({ ...step, change: changeOf(step) })), addedSteps }
  })
  return {
    legacyFlows: compared,
    flows: flows.map((flow) => ({ ...flow, legacyIds: compared.filter((legacy) => legacy.replacementIds.includes(flow.id)).map((legacy) => legacy.id) })),
  }
}

/** 旧システムのテーブルの列の移す先が、新しいテーブル（マイグレーション）にあるかを確かめる。 */
export function checkLegacyTables(legacyTables: readonly LegacyTableNode[], tables: readonly TableNode[], problems: ModelProblem[]): void {
  const columns = new Map(tables.map((table) => [table.id, new Set(table.columns.map((column) => column.name))]))
  for (const table of legacyTables) {
    if (table.columns.length === 0) {
      problems.push({ file: table.file, line: table.line, rule: 'legacy-table', message: `旧システムのテーブル「${table.name}」の列（columns）を書く` })
    }
    for (const column of table.columns) {
      if (column.name === '' || column.title === '') {
        problems.push({ file: table.file, line: table.line, rule: 'legacy-table', message: `旧システムのテーブル「${table.name}」の列に、名前（name）と意味（title）を書く` })
      }
      if (column.replacement !== null && columns.get(column.replacement.tableId)?.has(column.replacement.column) !== true) {
        problems.push({
          file: table.file,
          line: table.line,
          rule: 'legacy-table',
          message: `旧システムの列「${table.name}.${column.name}」の移す先「${column.replacement.tableId}.${column.replacement.column}」が、新しいテーブル（マイグレーション）にない`,
        })
      }
    }
  }
}
