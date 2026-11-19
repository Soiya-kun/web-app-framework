import { createHashHistory, createRootRoute, createRoute, createRouter, Link, Outlet, type RouterHistory } from '@tanstack/react-router'
import { FlowPage } from './page/flowPage'
import { GlossaryPage } from './page/glossaryPage'
import { HomePage } from './page/homePage'
import { ScenarioPage } from './page/scenarioPage'
import { StatementPage } from './page/statementPage'
import { TablePage } from './page/tablePage'
import { WorkPage } from './page/workPage'
import { text } from './text'

function RootLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
          <Link to="/" className="font-bold">
            {text.label('codeBrowser')}
          </Link>
          <Link to="/glossary" className="text-muted hover:text-ink [&.active]:font-bold [&.active]:text-ink">
            {text.label('glossary')}
          </Link>
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
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/flow/$flowId', component: FlowPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/scenario/$scenarioId', component: ScenarioPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/work/$workId', component: WorkPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/statement/$statementId', component: StatementPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/table/$tableId', component: TablePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/glossary', component: GlossaryPage }),
])

/** 画面の道筋。静的なファイルとして置けるように、URL の # の後ろで道筋を持つ。テストではメモリ上の履歴を渡す。 */
export function prepareRouter(history: RouterHistory = createHashHistory()) {
  return createRouter({ routeTree, history })
}
