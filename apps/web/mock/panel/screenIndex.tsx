// 画面の一覧（モックの最初のページ・Ctrl+K）。領域ごとに画面を並べ、使っているシナリオ・業務フローと根拠を出す。
// 見た画面の印とメモは、このブラウザに覚える（書き出して、議事録の課題などに写す）。
import { useState, useSyncExternalStore } from 'react'
import type { MockModel } from '../mockState'
import { openPage, type PageSummary } from './pageSummary'
import { changePanel, startFlow, usePanel } from './panelStore'

/** 画面ごとの確認の印とメモ。 */
type PageNote = { readonly checked: boolean; readonly memo: string }

const noteKey = 'mock-page-notes'
const noteListeners = new Set<() => void>()
let notes: Readonly<Record<string, PageNote>> = readNotes()

function readNotes(): Readonly<Record<string, PageNote>> {
  try {
    return JSON.parse(localStorage.getItem(noteKey) ?? '{}') as Record<string, PageNote>
  } catch {
    return {}
  }
}

function saveNote(pageId: string, note: PageNote): void {
  notes = { ...notes, [pageId]: note }
  try {
    localStorage.setItem(noteKey, JSON.stringify(notes))
  } catch {
    // 覚えられなくても、開いている間は印とメモを持つ。
  }
  for (const listener of noteListeners) {
    listener()
  }
}

function subscribeNotes(listener: () => void): () => void {
  noteListeners.add(listener)
  return () => noteListeners.delete(listener)
}

function useNotes(): Readonly<Record<string, PageNote>> {
  return useSyncExternalStore(subscribeNotes, () => notes)
}

/** 検索の言葉がすべて含まれる（空白で区切った言葉ごと）。 */
function matchWords(query: string, haystack: readonly string[]): boolean {
  const joined = haystack.join(' ').toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '')
    .every((word) => joined.includes(word))
}

function listHaystack(summary: PageSummary): readonly string[] {
  return [
    summary.page.title,
    summary.page.id,
    summary.areaTitle,
    ...summary.scenarios.map((scenario) => scenario.title),
    ...summary.flows.map((flow) => flow.title),
    ...summary.estimateItems.map((item) => `${item.number === null ? '' : `No.${item.number} `}${item.title}`),
  ]
}

/** 印とメモを、議事録の課題などに写せる Markdown にする。 */
function composeNoteText(summaries: readonly PageSummary[], pageNotes: Readonly<Record<string, PageNote>>): string {
  const lines = summaries.flatMap((summary) => {
    const note = pageNotes[summary.page.id]
    if (note === undefined || (!note.checked && note.memo === '')) {
      return []
    }
    return [`- [${note.checked ? 'x' : ' '}] ${summary.page.title}（${summary.page.id}）${note.memo === '' ? '' : `：${note.memo}`}`]
  })
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())
  return [`## 画面の確認メモ（${today}）`, '', ...lines, ''].join('\n')
}

function PageRow({ summary, note, busy }: { readonly summary: PageSummary; readonly note: PageNote; readonly busy: boolean }) {
  return (
    <tr className={note.checked ? 'checked' : undefined}>
      <td className="check">
        <input type="checkbox" checked={note.checked} aria-label={`${summary.page.title}を見た`} onChange={(event) => saveNote(summary.page.id, { ...note, checked: event.currentTarget.checked })} />
      </td>
      <td className="name">
        {summary.openable ? (
          <button
            type="button"
            onClick={() => {
              changePanel({ indexOpen: false })
              openPage(summary.page.id)
            }}
          >
            {summary.page.title}
          </button>
        ) : (
          <span title="URL に番号が入る画面です。一覧の画面から開いてください。">{summary.page.title}</span>
        )}
        <div className="mono muted">{summary.page.id}</div>
      </td>
      <td>
        <div className="chips">
          {summary.scenarios.length === 0 ? <span className="chip none">テストなし</span> : <span className="chip">シナリオ {summary.scenarios.length}</span>}
          {summary.openQuestions.length === 0 ? null : <span className="chip warn">未解決 {summary.openQuestions.length}</span>}
          {summary.decisions.length === 0 ? null : <span className="chip">決めたこと {summary.decisions.length}</span>}
          {summary.estimateItems.map((item) => (
            <span key={`${item.estimateId}-${item.number ?? item.title}`} className="chip" title={`${item.estimateTitle}：${item.title}`}>
              {item.number === null ? item.title : `No.${item.number}`}
            </span>
          ))}
        </div>
      </td>
      <td>
        <div className="chips">
          {summary.flows.map((flow) => (
            <button key={flow.id} type="button" className="chip" disabled={busy} title="このデータで始める" onClick={() => void startFlow(flow.id)}>
              {flow.title}
            </button>
          ))}
        </div>
      </td>
      <td className="memo">
        <input type="text" value={note.memo} placeholder="気づいたこと" onChange={(event) => saveNote(summary.page.id, { ...note, memo: event.currentTarget.value })} />
      </td>
    </tr>
  )
}

export function ScreenIndex({ summaries, model }: { readonly summaries: readonly PageSummary[]; readonly model: MockModel }) {
  const [query, changeQuery] = useState('')
  const [uncheckedOnly, changeUncheckedOnly] = useState(false)
  const [untestedOnly, changeUntestedOnly] = useState(false)
  const [noteText, changeNoteText] = useState<string | undefined>(undefined)
  const pageNotes = useNotes()
  const busy = usePanel().status.kind === 'running'
  const emptyNote: PageNote = { checked: false, memo: '' }
  const visible = summaries.filter(
    (summary) =>
      matchWords(query, listHaystack(summary)) &&
      (!uncheckedOnly || !(pageNotes[summary.page.id]?.checked ?? false)) &&
      (!untestedOnly || summary.scenarios.length === 0),
  )
  const areas = [...new Set(visible.map((summary) => summary.area))]
  const matchedFlows = query.trim() === '' ? [] : model.flows.filter((flow) => matchWords(query, [flow.title, flow.areaTitle, flow.id]))
  const checkedCount = summaries.filter((summary) => pageNotes[summary.page.id]?.checked ?? false).length
  const untestedCount = summaries.filter((summary) => summary.scenarios.length === 0).length
  const close = () => changePanel({ indexOpen: false })

  return (
    <div
      className="index"
      role="dialog"
      aria-label="画面の一覧"
      onClick={(event) => (event.target === event.currentTarget ? close() : undefined)}
      onKeyDown={(event) => (event.key === 'Escape' ? close() : undefined)}
    >
      <div className="index-sheet">
        <div className="index-head">
          <div className="row">
            <h1>画面の一覧</h1>
            <span className="small muted">
              {summaries.length} 画面・見た {checkedCount}・テストなし {untestedCount}
            </span>
            <span className="grow" />
            <button
              type="button"
              onClick={() => {
                const composed = composeNoteText(summaries, pageNotes)
                changeNoteText(composed)
                void navigator.clipboard?.writeText(composed).catch(() => undefined)
              }}
            >
              メモを書き出す
            </button>
            <button type="button" className="quiet" onClick={close} title="閉じる（Esc）">
              ✕
            </button>
          </div>
          <input type="search" autoFocus value={query} placeholder="画面・業務フロー・シナリオ・見積の No. で探す" onChange={(event) => changeQuery(event.currentTarget.value)} />
          <div className="row small">
            <label className="row">
              <input type="checkbox" checked={uncheckedOnly} onChange={(event) => changeUncheckedOnly(event.currentTarget.checked)} />
              まだ見ていない画面だけ
            </label>
            <label className="row">
              <input type="checkbox" checked={untestedOnly} onChange={(event) => changeUntestedOnly(event.currentTarget.checked)} />
              テストのない画面だけ
            </label>
          </div>
          {noteText === undefined ? null : (
            <div className="small">
              <div className="row">
                <span className="muted">クリップボードにも写しました。</span>
                <button type="button" className="quiet" onClick={() => changeNoteText(undefined)}>
                  閉じる
                </button>
              </div>
              <textarea readOnly rows={6} value={noteText} />
            </div>
          )}
        </div>
        <div className="index-body">
          {matchedFlows.length === 0 ? null : (
            <>
              <h2>業務フロー（押すと、そのデータで始める）</h2>
              <div className="chips">
                {matchedFlows.map((flow) => (
                  <button key={flow.id} type="button" className="chip" disabled={busy} onClick={() => void startFlow(flow.id)}>
                    {flow.areaTitle}／{flow.title}
                  </button>
                ))}
              </div>
            </>
          )}
          {areas.map((area) => {
            const areaSummaries = visible.filter((summary) => summary.area === area)
            return (
              <section key={area} aria-label={areaSummaries[0]?.areaTitle ?? area}>
                <h2>{areaSummaries[0]?.areaTitle ?? area}</h2>
                <table>
                  <thead>
                    <tr>
                      <th>見た</th>
                      <th>画面</th>
                      <th>テスト・根拠</th>
                      <th>使う業務フロー</th>
                      <th>メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaSummaries.map((summary) => (
                      <PageRow key={summary.page.id} summary={summary} note={pageNotes[summary.page.id] ?? emptyNote} busy={busy} />
                    ))}
                  </tbody>
                </table>
              </section>
            )
          })}
          {visible.length === 0 ? <p className="muted">当てはまる画面がありません。</p> : null}
        </div>
      </div>
    </div>
  )
}
