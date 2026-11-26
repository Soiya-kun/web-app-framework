// 開発パネルの入口。モックのサーバー（memoryServer.ts）が画面の HTML に差し込み、画面のモジュールより先に動く。
// 開発パネルは画面と別の影の木（Shadow DOM）に置く。シナリオの操作（Testing Library）は影の木の中を探さないので、
// 開発パネルのボタンと画面のボタンを取り違えない。
import './requestWatch'
import { configure, screen as documentScreen } from '@testing-library/dom'
import { createRoot } from 'react-dom/client'
import { panelStyle, panelWidth } from './panelStyle'
import { advanceCourse, changePanel, consumeQuietStart, hasPendingRun, loadModel, readPanel, registerHighlight, resumePending, skipOpening, watchPanel } from './panelStore'
import { PanelView } from './panelView'

// 実ブラウザでは画面の通信を待つので、テストより長く待つ。見つからないときの知らせは1文だけにする（画面の HTML を並べない）。
configure({
  asyncUtilTimeout: 5_000,
  getElementError: (message) => new Error((message ?? '').split('\n\n')[0]),
})

// 画面のルーターが最初のページを別の画面へ移す前の URL（最初のページで開いたなら、画面の一覧を開く）。
const firstPathname = window.location.pathname

const host = document.createElement('div')
host.dataset['mockPanel'] = ''
document.body.append(host)
const shadowRoot = host.attachShadow({ mode: 'open' })
const style = document.createElement('style')
style.textContent = panelStyle
const highlightBox = document.createElement('div')
highlightBox.className = 'root highlight'
highlightBox.hidden = true
const captionBox = document.createElement('div')
captionBox.className = 'root caption'
captionBox.hidden = true
const container = document.createElement('div')
shadowRoot.append(style, highlightBox, captionBox, container)

function waitMoment(milliseconds: number): Promise<void> {
  return new Promise((finish) => window.setTimeout(finish, milliseconds))
}

// 「見せる」で、操作する欄・ボタンを枠で囲み、その操作の1文を添える。
registerHighlight(async (element, caption) => {
  if (caption === '') {
    highlightBox.hidden = true
    captionBox.hidden = true
    return
  }
  element.scrollIntoView({ block: 'center', inline: 'nearest' })
  const rect = element.getBoundingClientRect()
  highlightBox.style.top = `${rect.top - 4}px`
  highlightBox.style.left = `${rect.left - 4}px`
  highlightBox.style.width = `${rect.width + 8}px`
  highlightBox.style.height = `${rect.height + 8}px`
  highlightBox.hidden = false
  captionBox.textContent = caption
  captionBox.style.top = rect.top < 48 ? `${rect.bottom + 10}px` : `${rect.top - 38}px`
  captionBox.style.left = `${Math.max(8, rect.left)}px`
  captionBox.hidden = false
  await waitMoment(1_000)
})

// 開発パネルを開いている間は、画面を開発パネルの幅だけ左へ寄せる。
watchPanel((state) => {
  document.body.style.marginRight = state.panelOpen ? `${panelWidth}px` : ''
})

window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    changePanel({ indexOpen: !readPanel().indexOpen })
  }
  if (event.key === 'Escape' && readPanel().indexOpen) {
    changePanel({ indexOpen: false })
  }
})

createRoot(container).render(<PanelView />)

/**
 * 始め方。コードのブラウザの「モックで開く」（?mock-flow=…&mock-step=…）なら、その段まで進める。
 * 「ここまで進める」で読み込み直したのなら、その続きを流す。どちらでもなく最初のページを開いたのなら、画面の一覧を開く
 * （開発パネルで業務フローを選び直して読み込み直したときは開かない）。
 */
async function startPanel(): Promise<void> {
  const quiet = consumeQuietStart()
  const search = new URLSearchParams(window.location.search)
  const linkedFlow = search.get('mock-flow')
  if (linkedFlow !== null) {
    window.history.replaceState(null, '', window.location.pathname)
    await advanceCourse(linkedFlow, search.get('mock-path') ?? 'main', search.get('mock-step') ?? '1')
    return
  }
  await loadModel()
  if (hasPendingRun()) {
    await resumePending()
    return
  }
  await skipOpening()
  if (firstPathname === '/' && !quiet) {
    // 画面の一覧は、画面のナビゲーションと同じ順に並べるので、ナビゲーションが出てから開く。
    await documentScreen.findByRole('navigation', { hidden: true }, { timeout: 15_000 }).catch(() => undefined)
    changePanel({ indexOpen: true })
  }
}

startPanel().catch((error: unknown) => {
  changePanel({ status: { kind: 'failed', caption: '開発パネルの準備', message: error instanceof Error ? error.message : String(error) } })
})
