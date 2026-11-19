// ソースを静的解析して、コードのブラウザのモデルを作る。業務フローから SQL・テーブルまでをつなぎ、書き方の規則を検査する。
import { conceptList, renderNounPhrase } from '@app/vocabulary'
import ts from 'typescript'
import { readBackendModel } from './backendModel'
import { readFlowModel, type ScenarioDraft } from './flowModel'
import { buttonTextOf } from './screenText'
import { prepareSourceReader, readString, unwrap } from './source'
import type { FlowStepNode, GlossaryEntry, Model, PageNode, ScenarioNode, ScenarioUse } from './types'
import { readWebModel, type WebModel } from './webModel'

/** シナリオの手順から、開く画面・押すボタンをたどる。 */
function traceScenario(scenario: ScenarioDraft, web: WebModel): { pageIds: string[]; actionEndpointIds: string[]; queryEndpointIds: string[] } {
  const pages = new Map<string, PageNode>(web.pages.map((page) => [page.id, page]))
  const pageIds: string[] = []
  const actionEndpointIds: string[] = []
  let current: PageNode | undefined
  const body = scenario.operateBody
  const statements = body !== null && ts.isBlock(body) ? body.statements : []
  for (const statement of statements) {
    const expression = ts.isExpressionStatement(statement) ? unwrap(statement.expression) : undefined
    if (expression === undefined || !ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) {
      continue
    }
    const method = expression.expression.name.text
    const receiver = unwrap(expression.expression.expression)
    const inRow = ts.isCallExpression(receiver)
    const key = readString(expression.arguments[0])
    if (method === 'go' && key !== undefined) {
      current = pages.get(web.navigation.get(key) ?? '')
    }
    if (method === 'follow' && current !== undefined) {
      const link = current.links.find((candidate) => candidate.inTable === inRow) ?? current.links[0]
      current = link === undefined ? current : pages.get(link.to)
    }
    if (method === 'press' && current !== undefined && key !== undefined) {
      const action = current.actions.find((candidate) => candidate.button === buttonTextOf(key))
      actionEndpointIds.push(...(action?.endpointIds ?? []))
    }
    if (current !== undefined && !pageIds.includes(current.id)) {
      pageIds.push(current.id)
    }
  }
  const queryEndpointIds = pageIds.flatMap((pageId) => pages.get(pageId)?.queryEndpointIds ?? [])
  return { pageIds, actionEndpointIds: [...new Set(actionEndpointIds)], queryEndpointIds: [...new Set(queryEndpointIds)] }
}

function readGlossary(): GlossaryEntry[] {
  return conceptList
    .filter((concept) => concept.kind === 'domain' || concept.description !== '')
    .map((concept) => ({
      id: concept.id,
      category: concept.category,
      japanese:
        concept.category === 'verb'
          ? (concept.ja.label ?? concept.ja.noun ?? concept.ja.dictionary ?? concept.id)
          : concept.category === 'adjective'
            ? (concept.ja.label ?? renderNounPhrase(concept.id, 'ja'))
            : renderNounPhrase(concept.id, 'ja'),
      english: concept.en.label,
      description: concept.description,
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
}

export function buildModel(root: string): Model {
  const reader = prepareSourceReader(root)
  const backend = readBackendModel(reader)
  const web = readWebModel(reader)
  const draft = readFlowModel(reader)
  const problems = [...draft.problems]

  // シナリオを使う段と、拡張を流す経路。
  const usedIn = new Map<string, ScenarioUse[]>()
  const extensionPaths = new Map<string, string[]>()
  const visitSteps = (flowId: string, flowTitle: string, steps: readonly FlowStepNode[]) => {
    for (const step of steps) {
      if (step.scenarioId !== null) {
        usedIn.set(step.scenarioId, [...(usedIn.get(step.scenarioId) ?? []), { flowId, number: step.number }])
      }
      for (const extension of step.extensions) {
        const key = `${step.scenarioId ?? ''}#${extension.name}`
        extensionPaths.set(key, [...(extensionPaths.get(key) ?? []), `${flowTitle} ${extension.key}`])
        visitSteps(flowId, flowTitle, extension.then)
      }
    }
  }
  for (const flow of draft.flows) {
    visitSteps(flow.id, flow.title, flow.steps)
  }

  const endpointWorks = new Map(backend.endpoints.map((endpoint) => [endpoint.id, endpoint.workIds]))
  const scenarios: ScenarioNode[] = draft.scenarios.map((scenario) => {
    const trace = traceScenario(scenario, web)
    const testing = draft.cases.get(scenario.id)
    const cases = testing?.cases ?? []
    const uses = usedIn.get(scenario.id) ?? []
    if (uses.length === 0) {
      problems.push({ file: scenario.file, line: scenario.line, rule: 'scenario-orphan', message: `シナリオ「${scenario.id}」がどの業務フローにも入っていない（業務フローの段にする）` })
    }
    for (const caseNode of cases) {
      if (caseNode.extension !== null && !scenario.extensions.some((extension) => extension.name === caseNode.extension)) {
        problems.push({ file: caseNode.file, line: caseNode.line, rule: 'case-extension', message: `拡張「${caseNode.extension}」はシナリオ「${scenario.id}」にない` })
      }
    }
    const workIds = [...new Set([...trace.actionEndpointIds, ...trace.queryEndpointIds].flatMap((endpointId) => endpointWorks.get(endpointId) ?? []))]
    return {
      id: scenario.id,
      title: scenario.title,
      purpose: scenario.purpose,
      actor: scenario.actor,
      actorTitle: renderNounPhrase(scenario.actor, 'ja'),
      pending: scenario.pending,
      steps: scenario.steps,
      guarantee: scenario.guarantee,
      extensions: scenario.extensions.map((extension) => {
        const caseCount = cases.filter((caseNode) => caseNode.extension === extension.name && !caseNode.pending).length
        const flowPaths = extensionPaths.get(`${scenario.id}#${extension.name}`) ?? []
        return { ...extension, caseCount, flowPaths, pending: extension.handling === null && caseCount === 0 && flowPaths.length === 0 }
      }),
      cases,
      testFile: testing?.testFile ?? null,
      usedIn: uses,
      pageIds: trace.pageIds,
      actionEndpointIds: trace.actionEndpointIds,
      queryEndpointIds: trace.queryEndpointIds,
      workIds,
      file: scenario.file,
      line: scenario.line,
    }
  })

  const countSteps = (steps: readonly FlowStepNode[]): number => steps.reduce((count, step) => count + 1 + step.extensions.reduce((sum, extension) => sum + countSteps(extension.then), 0), 0)
  const allExtensions = scenarios.flatMap((scenario) => scenario.extensions)
  const allCases = scenarios.flatMap((scenario) => scenario.cases)
  return {
    flows: draft.flows,
    scenarios,
    pages: web.pages,
    endpoints: backend.endpoints,
    works: backend.works,
    rules: backend.rules,
    statements: backend.statements,
    tables: backend.tables,
    glossary: readGlossary(),
    problems: problems.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line),
    progress: {
      flows: draft.flows.length,
      flowSteps: draft.flows.reduce((count, flow) => count + countSteps(flow.steps), 0),
      scenarios: scenarios.length,
      pendingScenarios: scenarios.filter((scenario) => scenario.pending).length,
      extensions: allExtensions.length,
      pendingExtensions: allExtensions.filter((extension) => extension.pending).length,
      cases: allCases.length,
      pendingCases: allCases.filter((caseNode) => caseNode.pending).length,
    },
  }
}
