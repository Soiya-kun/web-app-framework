// 画面ごとに、使っているシナリオ・業務フローと、根拠（見積の項目・議事録で決めたこと・未解決の課題）をまとめる。
// 画面の一覧（screenIndex.tsx）と、開発パネルの「この画面」で使う。
import type { FlowNode, MeetingPlaceNode, PageNode, ScenarioNode } from '@app/translator/model-types'
import { renderNounPhrase } from '@app/vocabulary'
import type { MockDecision, MockEstimateItem, MockModel, MockQuestion } from '../mockState'

export type PageSummary = {
  readonly page: PageNode
  /** 画面のフォルダ（src/<領域>）。 */
  readonly area: string
  readonly areaTitle: string
  /** URL に番号などが入る画面（一覧から開く画面）なら false。 */
  readonly openable: boolean
  readonly scenarios: readonly Omit<ScenarioNode, 'cases'>[]
  readonly flows: readonly FlowNode[]
  readonly estimateItems: readonly MockEstimateItem[]
  readonly decisions: readonly MockDecision[]
  readonly openQuestions: readonly MockQuestion[]
}

function renderArea(area: string): string {
  try {
    return renderNounPhrase(area, 'ja')
  } catch {
    return area
  }
}

function readArea(page: PageNode): string {
  return /^apps\/web\/src\/([^/]+)\//.exec(page.file.replaceAll('\\', '/'))?.[1] ?? 'other'
}

/** 議事録の場所が、この画面か、この画面を使うシナリオ（その拡張を含む）を指している。 */
function isPagePlace(place: MeetingPlaceNode, pageId: string, scenarioIds: ReadonlySet<string>): boolean {
  return (place.kind === 'page' && place.id === pageId) || ((place.kind === 'scenario' || place.kind === 'extension') && scenarioIds.has(place.id))
}

/** 画面の上のナビゲーションのリンクの並び（画面の一覧を、同じ順に並べるため）。 */
export function readNavigationPaths(): readonly string[] {
  return [...document.querySelectorAll<HTMLAnchorElement>('nav a')].flatMap((link) => {
    const path = link.getAttribute('href')
    return path === null ? [] : [path]
  })
}

/** 画面ごとのまとめ。並びはナビゲーションのリンクの順（ナビゲーションにない画面は、その領域の後ろ）。 */
export function summarizePages(model: MockModel, navigationPaths: readonly string[]): readonly PageSummary[] {
  const navigationOrder = new Map(navigationPaths.map((path, index) => [path, index]))
  const flows = new Map(model.flows.map((flow) => [flow.id, flow]))
  const summaries = model.pages.map((page): PageSummary => {
    const scenarios = model.scenarios.filter((scenario) => scenario.pageIds.includes(page.id))
    const scenarioIds = new Set(scenarios.map((scenario) => scenario.id))
    const flowIds = [...new Set(scenarios.flatMap((scenario) => scenario.usedIn.map((use) => use.flowId)))]
    const area = readArea(page)
    return {
      page,
      area,
      areaTitle: renderArea(area),
      openable: !page.id.includes('$'),
      scenarios,
      flows: flowIds.flatMap((flowId) => {
        const flow = flows.get(flowId)
        return flow === undefined ? [] : [flow]
      }),
      estimateItems: model.estimateItems.filter((item) => item.targets.some((target) => target.kind === 'scenario' && scenarioIds.has(target.id))),
      decisions: model.decisions.filter((decision) => decision.places.some((place) => isPagePlace(place, page.id, scenarioIds))),
      openQuestions: model.questions.filter((question) => !question.resolved && question.places.some((place) => isPagePlace(place, page.id, scenarioIds))),
    }
  })
  const areaOrder = new Map<string, number>()
  for (const summary of summaries) {
    const order = navigationOrder.get(summary.page.id) ?? Number.MAX_SAFE_INTEGER
    areaOrder.set(summary.area, Math.min(areaOrder.get(summary.area) ?? Number.MAX_SAFE_INTEGER, order))
  }
  const orderOf = (summary: PageSummary) => navigationOrder.get(summary.page.id) ?? Number.MAX_SAFE_INTEGER
  return [...summaries].sort(
    (left, right) => (areaOrder.get(left.area) ?? 0) - (areaOrder.get(right.area) ?? 0) || left.area.localeCompare(right.area) || orderOf(left) - orderOf(right),
  )
}

/** URL の道筋に当たる画面（/orders/123 なら /orders/$documentNumber）。 */
export function matchPage(summaries: readonly PageSummary[], pathname: string): PageSummary | undefined {
  return summaries.find((summary) => new RegExp(`^${summary.page.id.replace(/\$[^/]+/g, '[^/]+')}/?$`).test(pathname))
}

/** 画面を開く。ナビゲーションにリンクがあれば押して（読み込み直さずに）開き、なければ URL を開き直す。 */
export function openPage(path: string): void {
  const navigationLink = [...document.querySelectorAll<HTMLAnchorElement>('nav a')].find((link) => link.getAttribute('href') === path)
  if (navigationLink === undefined) {
    window.location.assign(path)
    return
  }
  navigationLink.click()
}
