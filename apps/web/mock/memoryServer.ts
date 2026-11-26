// 手元で画面を試す（モック）。DB をモック DB にした API サーバーと、画面の開発サーバーを起動する（pnpm dev:mock）。
// モック DB には、選んだ業務フローの事前条件の行（precondition.seed）を入れる。業務フローは画面の右の開発パネルで選び直す。
// 業務フローどうしで伝票番号やコードが重なるので、全部の業務フローの行をまとめては入れない。
// DB はメモリにあるだけなので、止めると消える。業務フローを選び直すと、その事前条件の行から始め直す。
// 開発パネル（panel/panelEntry.tsx）は、画面の HTML にだけ差し込む。本番の画面（pnpm dev:web・ビルド）には入らない。
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareApp } from '@app/backend'
import { prepareMemoryDatabase, prepareMemoryDependency, type MemoryDatabase } from '@app/backend/testing'
import type { Flow } from '@app/flow'
import { buildModel } from '@app/translator/model'
import { renderNounPhrase } from '@app/vocabulary'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createServer, type Plugin } from 'vite'
import { composeMockModel } from './mockModel'
import { mockPaths, type MockState, type StateRequest, type TodayRequest } from './mockState'

type SeedFlow = Flow<Partial<MemoryDatabase>>

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url))

/** コードのブラウザ（pnpm dev:browser）の URL。開発パネルから、シナリオ・処理のページへリンクする。 */
const browserOrigin = process.env['BROWSER_ORIGIN'] ?? 'http://localhost:5199'

/** 画面の開発サーバーの番号。コードのブラウザの「モックで開く」は、ここを開く（変えたらコードのブラウザに VITE_MOCK_ORIGIN を渡す）。 */
const screenPort = Number(process.env['MOCK_PORT'] ?? '5173')

function isFlow(value: unknown): value is SeedFlow {
  return typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'flow'
}

/** flow の下の業務フローを読む。 */
async function listFlows(): Promise<readonly SeedFlow[]> {
  const flowDirectory = new URL('../flow/', import.meta.url)
  const flows: SeedFlow[] = []
  for (const area of readdirSync(flowDirectory, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const fileNames = readdirSync(new URL(`${area.name}/`, flowDirectory)).filter((fileName) => fileName.endsWith('.ts') && !fileName.endsWith('.test.ts'))
    for (const fileName of fileNames) {
      const flowFile = (await import(new URL(`${area.name}/${fileName}`, flowDirectory).href)) as Readonly<Record<string, unknown>>
      flows.push(...Object.values(flowFile).filter(isFlow))
    }
  }
  return flows
}

function renderName(name: string): string {
  try {
    return renderNounPhrase(name, 'ja')
  } catch {
    return name
  }
}

const flows = await listFlows()
const firstName = process.argv[2]
let state: MockState = { flowName: null, clockOffset: 0 }
if (firstName !== undefined) {
  if (!flows.some((flow) => flow.name === firstName)) {
    throw new Error(`業務フロー「${firstName}」がありません。`)
  }
  state = { flowName: firstName, clockOffset: 0 }
}

/** 業務フローの事前条件の行を入れたモック DB で、API を組み立てる。行は写して入れ、選び直したときに元の行を汚さない。 */
function prepareFlowApp(flowName: string | null) {
  const flow = flows.find((candidate) => candidate.name === flowName)
  const database = prepareMemoryDatabase(structuredClone(flow?.precondition?.seed ?? {}))
  return prepareApp(prepareMemoryDependency(database))
}

let app = prepareFlowApp(state.flowName)

console.log('コードのブラウザのモデルを作っています…')
const mockModel = composeMockModel(buildModel(repositoryRoot, 'ja'))

const memoryServer = new Hono()
  .get(mockPaths.state, (context) => context.json(state))
  .post(mockPaths.state, async (context) => {
    const { flowName } = await context.req.json<StateRequest>()
    if (flowName !== null && !flows.some((flow) => flow.name === flowName)) {
      return context.json({ message: `業務フロー「${flowName}」がありません。` }, 404)
    }
    state = { flowName, clockOffset: 0 }
    app = prepareFlowApp(flowName)
    return context.json(state)
  })
  .post(mockPaths.today, async (context) => {
    const { date } = await context.req.json<TodayRequest>()
    // バックエンドは今日を読まない（日付は画面が送る）ので、ずれは画面の時計（開発パネル）にだけ当てる。
    state = { ...state, clockOffset: new Date(`${date}T09:00:00+09:00`).getTime() - Date.now() }
    return context.json(state)
  })
  .get(mockPaths.model, (context) => context.json(mockModel))
  .all('*', (context) => app.fetch(context.req.raw))

/**
 * 画面の HTML に、開発パネルを差し込む。今の状態（業務フロー・時計のずれ）は HTML を返すときに書き込み、
 * 開発パネルが画面より先に時計をずらせるようにする（モジュールは書いた順に動く）。
 */
function injectPanel(): Plugin {
  return {
    name: 'mock-panel',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: 'mock-state', content: JSON.stringify(state) }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'mock-browser-origin', content: browserOrigin }, injectTo: 'head' },
      { tag: 'script', attrs: { type: 'module', src: '/mock/panel/panelEntry.tsx' }, injectTo: 'head' },
    ],
  }
}

const apiOrigin = await new Promise<string>((finish) => {
  serve({ fetch: memoryServer.fetch, port: 0 }, (address) => finish(`http://localhost:${address.port}`))
})
const screenServer = await createServer({
  root: join(repositoryRoot, 'apps/web'),
  configFile: join(repositoryRoot, 'apps/web/vite.config.ts'),
  plugins: [injectPanel()],
  server: { port: screenPort, proxy: { '/api': apiOrigin } },
})
await screenServer.listen()
const screenOrigin = screenServer.resolvedUrls?.local[0] ?? ''
console.log(`モックの画面: ${screenOrigin}`)
console.log(`いまのデータ: ${state.flowName === null ? '空の DB' : renderName(state.flowName)}（画面の右の「開発パネル」で業務フローを選び直せます）`)
if (!screenOrigin.includes(`:${screenPort}/`)) {
  console.log(`${screenPort} 番が使われていたので、別の番号で開きました。コードのブラウザの「モックで開く」を使うときは、VITE_MOCK_ORIGIN=${screenOrigin.replace(/\/$/, '')} を付けて pnpm dev:browser を起動してください。`)
}
