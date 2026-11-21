import type {
  EndpointNode,
  FlowNode,
  LegacyFlowNode,
  LegacyTableNode,
  MeetingNode,
  Model,
  PageNode,
  QuestionNode,
  RoleNode,
  RuleNode,
  ScenarioNode,
  StatementNode,
  TableNode,
  WorkNode,
} from '@app/translator/model-types'
import { createContext, use, useMemo, type ReactNode } from 'react'

/** モデルと、ID から要素を引く表。 */
export type ModelTable = {
  readonly model: Model
  readonly flows: ReadonlyMap<string, FlowNode>
  readonly legacyFlows: ReadonlyMap<string, LegacyFlowNode>
  readonly legacyTables: ReadonlyMap<string, LegacyTableNode>
  readonly scenarios: ReadonlyMap<string, ScenarioNode>
  readonly pages: ReadonlyMap<string, PageNode>
  readonly endpoints: ReadonlyMap<string, EndpointNode>
  readonly works: ReadonlyMap<string, WorkNode>
  readonly rules: ReadonlyMap<string, RuleNode>
  readonly statements: ReadonlyMap<string, StatementNode>
  readonly tables: ReadonlyMap<string, TableNode>
  readonly roles: ReadonlyMap<string, RoleNode>
  readonly meetings: ReadonlyMap<string, MeetingNode>
  readonly questions: ReadonlyMap<string, QuestionNode>
}

const ModelContext = createContext<ModelTable | null>(null)

function prepareModelTable(model: Model): ModelTable {
  const prepareNodeTable = <Node extends { readonly id: string }>(nodes: readonly Node[]) => new Map(nodes.map((node) => [node.id, node]))
  return {
    model,
    flows: prepareNodeTable(model.flows),
    legacyFlows: prepareNodeTable(model.legacyFlows),
    legacyTables: prepareNodeTable(model.legacyTables),
    scenarios: prepareNodeTable(model.scenarios),
    pages: prepareNodeTable(model.pages),
    endpoints: prepareNodeTable(model.endpoints),
    works: prepareNodeTable(model.works),
    rules: prepareNodeTable(model.rules),
    statements: prepareNodeTable(model.statements),
    tables: prepareNodeTable(model.tables),
    roles: prepareNodeTable(model.roles),
    meetings: prepareNodeTable(model.meetings),
    questions: prepareNodeTable(model.questions),
  }
}

/** ブラウザが表示するモデルを渡す。本番は生成した model.json、テストは解析の結果を渡す。 */
export function ModelProvider({ model, children }: { readonly model: Model; readonly children: ReactNode }) {
  const table = useMemo(() => prepareModelTable(model), [model])
  return <ModelContext value={table}>{children}</ModelContext>
}

export function useModel(): ModelTable {
  const table = use(ModelContext)
  if (table === null) {
    throw new Error('ModelProvider の中で使ってください。')
  }
  return table
}
