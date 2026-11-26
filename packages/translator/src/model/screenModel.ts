// IPA「機能要件の合意形成ガイド 画面編」の成果物（画面一覧・画面遷移・画面レイアウト・画面入出力項目一覧・画面アクション明細・
// 画面遷移・レイアウト共通ルール）のもとを、静的解析で読んだ画面の部品・シナリオ・処理・SQL・画面遷移のテストから作る。
// 求められない項目（表示桁数・入力桁数・文字種・必須など）は出さない。
import type { LabelKey } from '@app/vocabulary/text'
import type { ScreenText } from './screenText'
import type { SourceReader } from './source'
import type { EndpointNode, PageNode, ScenarioNode, ScreenActionNode, ScreenItemNode, ScreenNode, StatementNode, StyleTokenNode, TableNode, TransitionNode, WorkNode } from './types'

const styleFile = 'apps/web/src/style.css'

type ScreenTables = {
  readonly pages: readonly PageNode[]
  readonly navigation: ReadonlyMap<string, string>
  readonly scenarios: readonly ScenarioNode[]
  readonly endpoints: readonly EndpointNode[]
  readonly works: readonly WorkNode[]
  readonly statements: readonly StatementNode[]
  readonly tables: readonly TableNode[]
  readonly transitions: readonly TransitionNode[]
}

/** 画面の分類。入力欄が2つ以上なら入力フォーム、表があって道筋に引数がなければ一覧表示、ほかは情報表示。 */
function classifyScreen(page: PageNode): ScreenNode['kind'] {
  const inputs = page.elements.filter((element) => element.kind === 'textInput' || element.kind === 'selectInput').length
  if (inputs >= 2) {
    return 'form'
  }
  return page.elements.some((element) => element.kind === 'table') && !page.id.includes('$') ? 'list' : 'detail'
}

export function buildScreens(screen: ScreenText, tables: ScreenTables): ScreenNode[] {
  const { pages, scenarios } = tables
  const screenByPath = new Map(pages.map((page) => [page.id, page]))
  const navigationPaths = new Set(tables.navigation.values())
  const allEdges = tables.transitions.flatMap((transition) => transition.traces.flatMap((trace) => trace.edges))
  // 階層: ナビゲーションの画面から、リンクと画面遷移をたどる（はじめて着いた道を使う）。
  const next = new Map<string, string[]>()
  for (const page of pages) {
    const targets = [
      ...page.elements.flatMap((element) => (element.kind === 'link' && element.to !== null ? [screenByPath.get(element.to)?.screenId ?? ''] : [])),
      ...allEdges.filter((edge) => edge.from === page.screenId).map((edge) => edge.to),
    ].filter((target) => target !== '' && target !== page.screenId)
    next.set(page.screenId, [...new Set(targets)])
  }
  const hierarchy = new Map<string, string[]>()
  const queue = pages.filter((page) => navigationPaths.has(page.id)).map((page) => page.screenId)
  queue.forEach((screenId) => hierarchy.set(screenId, [screenId]))
  while (queue.length > 0) {
    const screenId = queue.shift() ?? ''
    for (const target of next.get(screenId) ?? []) {
      if (!hierarchy.has(target)) {
        hierarchy.set(target, [...(hierarchy.get(screenId) ?? []), target])
        queue.push(target)
      }
    }
  }

  const workTable = new Map(tables.works.map((work) => [work.id, work]))
  const endpointTable = new Map(tables.endpoints.map((endpoint) => [endpoint.id, endpoint]))
  const statementTable = new Map(tables.statements.map((statement) => [statement.id, statement]))
  const tableTitles = new Map(tables.tables.map((table) => [table.id, table.title]))
  const labelIfAny = (value: string | null): string | null => {
    if (value === null || value === '') {
      return null
    }
    const label = screen.language.text.label(value as LabelKey)
    return label === value ? value : label
  }

  return pages.map((page): ScreenNode => {
    const usingScenarios = scenarios.filter((scenario) => scenario.pageIds.includes(page.id))
    const elementLabel = (number: string) => {
      const element = page.elements.find((candidate) => candidate.number === number)
      return element === undefined ? number : `${number} ${element.label}`
    }
    const items: ScreenItemNode[] = page.elements.flatMap((element): ScreenItemNode[] => {
      if (element.kind === 'textInput' || element.kind === 'selectInput') {
        const field = element.field?.replace(/Id$/, '').toLowerCase() ?? ''
        const constraints = field === '' ? [] : usingScenarios.flatMap((scenario) => scenario.extensions.filter((extension) => extension.name.toLowerCase().includes(field)).map((extension) => extension.condition))
        const dataType = element.kind === 'selectInput' ? 'choice' : element.placeholder === 'YYYY-MM-DD' ? 'date' : element.inputMode === 'numeric' ? 'number' : 'text'
        return [
          {
            number: element.number,
            label: element.label,
            kind: element.kind,
            input: true,
            dataType,
            constraints: [...new Set(constraints)],
            initial: labelIfAny(element.initial),
            output: null,
            note: element.placeholder ?? '',
          },
        ]
      }
      if (element.kind === 'table') {
        return element.columns.map((column, index) => ({
          number: `${element.number}-${index + 1}`,
          label: column.label,
          kind: 'column' as const,
          input: false,
          dataType: null,
          constraints: [],
          initial: null,
          output: column.align === 'right' ? 'right' : null,
          note: element.label,
        }))
      }
      if (element.kind === 'status' || element.kind === 'alert') {
        return [{ number: element.number, label: element.label, kind: element.kind, input: false, dataType: null, constraints: [], initial: null, output: null, note: '' }]
      }
      return []
    })
    const actions: ScreenActionNode[] = page.elements.flatMap((element): ScreenActionNode[] => {
      if (element.kind !== 'button' && element.kind !== 'link') {
        return []
      }
      const event = `[${element.label}]`
      const transitionTargets = allEdges.filter((edge) => edge.from === page.screenId && edge.event === event).map((edge) => edge.to)
      if (element.kind === 'link') {
        const linkTarget = element.to === null ? undefined : screenByPath.get(element.to)?.screenId
        return [
          {
            number: element.number,
            kind: 'link',
            name: element.label,
            event: screen.language.sentence.follow(element.label.startsWith('〈') ? element.label : `「${element.label}」`),
            summary: [],
            steps: [],
            inputs: [],
            inputTables: [],
            outputTables: [],
            destinationIds: [...new Set([...(linkTarget === undefined ? [] : [linkTarget]), ...transitionTargets])],
          },
        ]
      }
      const works = [...new Set(element.endpointIds.filter((endpointId) => !endpointId.startsWith('GET ')).flatMap((endpointId) => endpointTable.get(endpointId)?.workIds ?? []))].flatMap((workId) => {
        const work = workTable.get(workId)
        return work === undefined ? [] : [work]
      })
      const statements = works.flatMap((work) => work.repositoryCalls.flatMap((call) => call.statementIds.flatMap((statementId) => statementTable.get(statementId) ?? [])))
      const isWrite = (statement: StatementNode) => /^\s*(insert|update|delete)\b/i.test(statement.text)
      const tablesOf = (write: boolean) => [...new Set(statements.filter((statement) => isWrite(statement) === write).flatMap((statement) => statement.tableIds))].map((tableId) => tableTitles.get(tableId) ?? tableId)
      return [
        {
          number: element.number,
          kind: 'button',
          name: element.label,
          event: screen.language.sentence.press(element.label),
          summary: works.map((work) => work.title),
          steps: works.flatMap((work) => work.steps.map((step) => step.text)),
          inputs: element.formItems.map(elementLabel),
          inputTables: tablesOf(false),
          outputTables: tablesOf(true),
          destinationIds: [...new Set(transitionTargets)],
        },
      ]
    })
    return {
      id: page.screenId,
      path: page.id,
      title: page.title,
      summary: page.summary,
      kind: classifyScreen(page),
      hierarchy: hierarchy.get(page.screenId) ?? [page.screenId],
      scenarioIds: usingScenarios.map((scenario) => scenario.id),
      navigation: navigationPaths.has(page.id),
      elements: page.elements,
      items,
      actions,
      file: page.file,
      line: page.line,
    }
  })
}

/** 画面の見た目の決まり（style.css の @theme の --名前: 値;）。 */
export function readStyleTokens(reader: SourceReader): StyleTokenNode[] {
  if (!reader.exists(styleFile)) {
    return []
  }
  const theme = /@theme\s*\{([\s\S]*?)\}/.exec(reader.text(styleFile))?.[1] ?? ''
  return [...theme.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((match) => ({ name: match[1] ?? '', value: (match[2] ?? '').trim() }))
}
