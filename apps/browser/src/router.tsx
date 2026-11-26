import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useRouterState,
  type RouterHistory,
} from '@tanstack/react-router'
import { CanvasPage } from './page/canvasPage'
import { FlowPage } from './page/flowPage'
import { EstimateListPage } from './page/estimateListPage'
import { EstimatePage } from './page/estimatePage'
import { GlossaryPage } from './page/glossaryPage'
import { HomePage } from './page/homePage'
import { LegacyListPage } from './page/legacyListPage'
import { LegacyPage } from './page/legacyPage'
import { LegacyTablePage } from './page/legacyTablePage'
import { MeetingListPage } from './page/meetingListPage'
import { MeetingPage } from './page/meetingPage'
import { ScenarioPage } from './page/scenarioPage'
import { ScreenListPage } from './page/screenListPage'
import { ScreenPage } from './page/screenPage'
import { ScreenRulePage } from './page/screenRulePage'
import { StatementPage } from './page/statementPage'
import { TablePage } from './page/tablePage'
import { WorkPage } from './page/workPage'
import { LocaleToggle } from './component/part'
import { useText } from './text'

function RootLayout() {
  const text = useText()
  const routePath = useRouterState({ select: (state) => state.location.pathname })
  // キャンバスは画面いっぱいに出す（自分でツールバーを持つ）。
  if (routePath === '/') {
    return <Outlet />
  }
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
          <Link to="/" className="font-bold">
            {text.label('codeBrowser')}
          </Link>
          <Link to="/" className="text-muted hover:text-ink">
            {text.label('canvas')}
          </Link>
          <Link to="/list" className="text-muted hover:text-ink [&.active]:font-bold [&.active]:text-ink">
            {text.label('overview')}
          </Link>
          <Link to="/meetings" className="text-muted hover:text-ink [&.active]:font-bold [&.active]:text-ink">
            {text.label('minutes')}
          </Link>
          <Link to="/legacy" className="text-muted hover:text-ink [&.active]:font-bold [&.active]:text-ink">
            {text.label('legacy')}
          </Link>
          <Link to="/screens" className="text-muted hover:text-ink [&.active]:font-bold [&.active]:text-ink">
            {text.label('screen')}
          </Link>
          <Link to="/estimates" className="text-muted hover:text-ink [&.active]:font-bold [&.active]:text-ink">
            {text.label('estimate')}
          </Link>
          <Link to="/glossary" className="text-muted hover:text-ink [&.active]:font-bold [&.active]:text-ink">
            {text.label('glossary')}
          </Link>
          <LocaleToggle className="ml-auto" />
        </nav>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

const rootRoute = createRootRoute({ component: RootLayout })
const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: CanvasPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/list', component: HomePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/flow/$flowId', component: FlowPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/scenario/$scenarioId', component: ScenarioPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/work/$workId', component: WorkPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/statement/$statementId', component: StatementPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/table/$tableId', component: TablePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/glossary', component: GlossaryPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/meetings', component: MeetingListPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/meeting/$meetingId', component: MeetingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/legacy', component: LegacyListPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/estimates', component: EstimateListPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/screens', component: ScreenListPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/screens/rule', component: ScreenRulePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/screen/$screenId', component: ScreenPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/estimate/$estimateId', component: EstimatePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/legacy/$legacyId', component: LegacyPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/legacy/table/$tableId', component: LegacyTablePage }),
])

/** 画面の道筋。静的なファイルとして置けるように、URL の # の後ろで道筋を持つ。テストではメモリ上の履歴を渡す。 */
export function prepareRouter(history: RouterHistory = createHashHistory()) {
  return createRouter({ routeTree, history })
}
