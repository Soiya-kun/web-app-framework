// 開発パネル（モックの画面の右に重ねる）。いまのデータ・業務フローの段・いまの画面の根拠を出し、段を画面で流す。
import { listFlowPaths, type Flow, type FlowPath, type PathAction } from '@app/flow'
import type { FlowNode, ModelInput } from '@app/translator/model-types'
import { Suspense, use, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import type { MockModel } from '../mockState'
import { matchPage, readNavigationPaths, summarizePages, type PageSummary } from './pageSummary'
import {
  advanceCourse,
  changePanel,
  describeAction,
  describeOperations,
  operateCurrent,
  startFlow,
  usePanel,
  type Course,
  type PanelState,
} from './panelStore'
import { ScreenIndex } from './screenIndex'

const todayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' })

/** いまの画面の道筋。画面はルーターで移るので、少しずつ読み直す（戻る・進むはすぐ読む）。 */
function subscribeLocation(listener: () => void): () => void {
  const timer = window.setInterval(listener, 300)
  window.addEventListener('popstate', listener)
  return () => {
    window.clearInterval(timer)
    window.removeEventListener('popstate', listener)
  }
}

function usePathname(): string {
  return useSyncExternalStore(subscribeLocation, () => window.location.pathname)
}

/** コードのブラウザのページの URL（#/scenario/createOrder など）。 */
export function composeBrowserUrl(browserOrigin: string, kind: 'flow' | 'scenario' | 'work', id: string): string {
  return `${browserOrigin}/#/${kind}/${encodeURIComponent(id)}`
}

function BrowserLink({ kind, id, children }: { readonly kind: 'flow' | 'scenario' | 'work'; readonly id: string; readonly children: ReactNode }) {
  const { browserOrigin } = usePanel()
  return (
    <a href={composeBrowserUrl(browserOrigin, kind, id)} target="code-browser" rel="noreferrer" title="コードのブラウザで開く">
      {children}
    </a>
  )
}

/** 業務フローの段の入力（コードのブラウザのモデルの段から引く。子フロー・拡張の中の段も番号でたどる）。 */
function findStepInputs(flows: ReadonlyMap<string, FlowNode>, flowId: string, number: string): readonly ModelInput[] {
  const flow = flows.get(flowId)
  for (const step of flow?.steps ?? []) {
    if (step.number === number) {
      return step.inputs
    }
    for (const extension of step.extensions) {
      if (extension.key === number) {
        return extension.inputs
      }
      const followingStep = extension.then.find((candidate) => candidate.number === number)
      if (followingStep !== undefined) {
        return followingStep.inputs
      }
    }
    if (step.flowId !== null && number.startsWith(`${step.number}.`)) {
      return findStepInputs(flows, step.flowId, number.slice(step.number.length + 1))
    }
  }
  return []
}

const operationCache = new WeakMap<PathAction, Promise<readonly string[]>>()

function readOperations(action: Extract<PathAction, { readonly kind: 'operate' }>): Promise<readonly string[]> {
  const cached = operationCache.get(action)
  if (cached !== undefined) {
    return cached
  }
  const operations = describeOperations(action)
  operationCache.set(action, operations)
  return operations
}

/** いまの段で画面にすること（入れる値つき）。 */
function OperationList({ action }: { readonly action: Extract<PathAction, { readonly kind: 'operate' }> }) {
  const operations = use(readOperations(action))
  return (
    <ol className="operations">
      {operations.map((operation, index) => (
        <li key={index}>{operation}</li>
      ))}
    </ol>
  )
}

function StatusBox({ state }: { readonly state: PanelState }) {
  const { status } = state
  if (status.kind === 'running') {
    return (
      <div className="status running" role="status">
        {status.total > 1 ? `前の段を流しています（${status.done + 1}/${status.total}）：` : '流しています：'}
        {status.caption}
        {status.total > 1 ? (
          <div className="bar">
            <i style={{ width: `${Math.round((status.done / status.total) * 100)}%` }} />
          </div>
        ) : null}
      </div>
    )
  }
  if (status.kind === 'failed') {
    return (
      <div className="status failed" role="alert">
        <b>{status.caption}</b> で止まりました。
        <div className="mono">{status.message}</div>
      </div>
    )
  }
  return null
}

type StepProps = {
  readonly action: PathAction
  readonly index: number
  readonly course: Course
  readonly model: MockModel
  readonly flows: ReadonlyMap<string, FlowNode>
  readonly busy: boolean
}

function StepItem({ action, index, course, model, flows, busy }: StepProps) {
  const position = index < course.position ? 'done' : index === course.position ? 'current' : 'future'
  const inputs = action.kind === 'operate' ? findStepInputs(flows, course.flowName, action.number) : []
  const pending = action.kind === 'operate' && action.scenario.operate === undefined
  return (
    <li className={position}>
      <div className="step-line">
        <span className="mark">{position === 'done' ? '✓' : position === 'current' ? '▶' : ''}</span>
        <span className="step-number">{action.number}</span>
        <span className="title">
          {action.kind === 'operate' ? (
            <BrowserLink kind="scenario" id={action.scenario.name}>
              {describeAction(action, model)}
            </BrowserLink>
          ) : (
            describeAction(action, model)
          )}
        </span>
        {action.kind === 'elapse' ? <span className="tag">時の経過</span> : null}
        {action.kind === 'note' ? <span className="tag">画面の外</span> : null}
        {pending ? <span className="tag warn">未着手</span> : null}
      </div>
      {position === 'current' && action.kind === 'operate' && !pending ? (
        <Suspense fallback={null}>
          <OperationList action={action} />
        </Suspense>
      ) : inputs.length > 0 ? (
        <div className="inputs">
          {inputs.map((input) => (
            <div key={input.label}>
              <span>{input.label}</span>
              {input.value}
            </div>
          ))}
        </div>
      ) : null}
      {position === 'current' && action.kind !== 'operate' ? (
        <div className="step-tools">
          <button type="button" className="primary" disabled={busy} onClick={() => void operateCurrent('run')} title="時の経過なら今日を変えて、次に画面を操作する段まで進む">
            進む
          </button>
        </div>
      ) : action.kind !== 'operate' || pending ? null : position === 'current' ? (
        <div className="step-tools">
          <button type="button" className="primary" disabled={busy} onClick={() => void operateCurrent('show')} title="操作する欄・ボタンを光らせながら、ゆっくり流す">
            見せる
          </button>
          <button type="button" disabled={busy} onClick={() => void operateCurrent('run')} title="すぐに流して、次の段へ進む">
            流す
          </button>
          <button type="button" disabled={busy} onClick={() => void operateCurrent('fill')} title="入力だけ入れて、最後のボタンは押さずに残す">
            入れるだけ
          </button>
        </div>
      ) : (
        <div className="step-tools">
          <button type="button" disabled={busy} onClick={() => void advanceCourse(course.flowName, course.pathKey, action.number)} title="事前条件のデータから、この段の手前まで流して、この段の画面を開く">
            ここまで進める
          </button>
        </div>
      )}
    </li>
  )
}

function CourseCard({ state, flow, model }: { readonly state: PanelState; readonly flow: Flow<unknown>; readonly model: MockModel }) {
  const course = state.course as Course
  const paths = listFlowPaths(flow)
  const path: FlowPath = paths.find((candidate) => candidate.key === course.pathKey) ?? (paths[0] as FlowPath)
  const flows = useMemo(() => new Map(model.flows.map((node) => [node.id, node])), [model])
  const busy = state.status.kind === 'running'
  return (
    <section className="card" aria-label="段">
      <h2>
        段
        <span className="row">
          <button type="button" className="quiet" disabled={busy} onClick={() => void startFlow(course.flowName, course.pathKey)} title="事前条件のデータに戻して、最初の段から">
            最初から
          </button>
        </span>
      </h2>
      {paths.length > 1 ? (
        <label className="small">
          <span className="muted">経路（変えると、事前条件のデータから始め直します）</span>
          <select value={path.key} disabled={busy} onChange={(event) => void startFlow(course.flowName, event.currentTarget.value)}>
            {paths.map((candidate) => (
              <option key={candidate.key} value={candidate.key}>
                {candidate.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <StatusBox state={state} />
      <p className="small muted">段にマウスを乗せると「ここまで進める」が出ます（事前条件のデータから、その段の手前まで流します）。</p>
      <ol className="steps">
        {path.actions.map((action, index) => (
          <StepItem key={`${action.number}-${index}`} action={action} index={index} course={course} model={model} flows={flows} busy={busy} />
        ))}
      </ol>
      {course.position >= path.actions.length ? <p className="small muted">最後の段まで流しました。</p> : null}
    </section>
  )
}

function FlowCard({ state, model }: { readonly state: PanelState; readonly model: MockModel }) {
  const areas = [...new Set(model.flows.map((flow) => flow.areaTitle))]
  const flowName = state.mockState.flowName
  const flow = model.flows.find((candidate) => candidate.id === flowName)
  const busy = state.status.kind === 'running'
  return (
    <section className="card" aria-label="業務フロー">
      <h2>
        業務フロー
        {flow === undefined ? null : (
          <span className="row small">
            <BrowserLink kind="flow" id={flow.id}>
              コードのブラウザ
            </BrowserLink>
          </span>
        )}
      </h2>
      <select value={flowName ?? ''} disabled={busy} onChange={(event) => void startFlow(event.currentTarget.value === '' ? null : event.currentTarget.value)}>
        <option value="">空の DB（業務フローを選ばない）</option>
        {areas.map((area) => (
          <optgroup key={area} label={area}>
            {model.flows
              .filter((candidate) => candidate.areaTitle === area)
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {flow?.precondition === null || flow === undefined ? null : (
        <details>
          <summary>事前条件</summary>
          <p className="small">{flow.precondition}</p>
        </details>
      )}
    </section>
  )
}

function Basis({ summary }: { readonly summary: PageSummary }) {
  return (
    <>
      {summary.estimateItems.length === 0 ? null : (
        <div>
          <div className="small muted">見積の項目</div>
          <ul className="plain small">
            {summary.estimateItems.map((item) => (
              <li key={`${item.estimateId}-${item.number ?? item.title}`}>
                {item.number === null ? '' : `No.${item.number} `}
                {item.title}
                {item.note === null ? null : <span className="muted">（{item.note}）</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.openQuestions.length === 0 ? null : (
        <div>
          <div className="small muted">未解決の課題</div>
          <ul className="plain small">
            {summary.openQuestions.map((question, index) => (
              <li key={index} className="basis open">
                <span className="muted">{question.date}</span> {question.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.decisions.length === 0 ? null : (
        <details>
          <summary>議事録で決めたこと（{summary.decisions.length}）</summary>
          <ul className="plain small">
            {summary.decisions.map((decision, index) => (
              <li key={index} className="basis">
                <span className="muted">
                  {decision.date} {decision.meetingTitle}
                </span>
                <br />
                {decision.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

function PageCard({ summaries, pathname, model }: { readonly summaries: readonly PageSummary[]; readonly pathname: string; readonly model: MockModel }) {
  const summary = matchPage(summaries, pathname)
  const workTitles = new Map(model.works.map((work) => [work.id, work.title]))
  const busy = usePanel().status.kind === 'running'
  if (summary === undefined) {
    return (
      <section className="card" aria-label="この画面">
        <h2>この画面</h2>
        <p className="small muted">画面の一覧にない道筋です（{pathname}）。</p>
      </section>
    )
  }
  return (
    <section className="card" aria-label="この画面">
      <h2>
        この画面：{summary.page.title}
        <span className="row mono muted">{summary.page.id}</span>
      </h2>
      {summary.scenarios.length === 0 ? (
        <p className="small">
          <span className="chip none">テストなし</span> この画面を開くシナリオがありません。
        </p>
      ) : (
        <div>
          <div className="small muted">この画面を開くシナリオ（処理）</div>
          <ul className="plain small">
            {summary.scenarios.map((scenario) => (
              <li key={scenario.id}>
                <BrowserLink kind="scenario" id={scenario.id}>
                  {scenario.title}
                </BrowserLink>
                {scenario.workIds.length === 0 ? null : (
                  <span className="muted">
                    {' '}
                    （
                    {scenario.workIds.map((workId, index) => (
                      <span key={workId}>
                        {index === 0 ? '' : '・'}
                        <BrowserLink kind="work" id={workId}>
                          {workTitles.get(workId) ?? workId}
                        </BrowserLink>
                      </span>
                    ))}
                    ）
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.flows.length === 0 ? null : (
        <div>
          <div className="small muted">この画面を使う業務フロー（押すと、そのデータで始める）</div>
          <div className="chips">
            {summary.flows.map((flow) => (
              <button key={flow.id} type="button" className="chip" disabled={busy} onClick={() => void startFlow(flow.id)}>
                {flow.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <Basis summary={summary} />
    </section>
  )
}

function PanelContent({ state, model }: { readonly state: PanelState; readonly model: MockModel }) {
  const pathname = usePathname()
  // 並びは画面のナビゲーションから読むので、一覧を開くたびに作り直す（読み込んだ直後はナビゲーションがまだない）。
  const summaries = useMemo(() => summarizePages(model, readNavigationPaths()), [model, state.indexOpen])
  const flowTitle = model.flows.find((flow) => flow.id === state.mockState.flowName)?.title ?? '空の DB'
  return (
    <>
      <div className="facts small">
        <span>
          データ <b>{flowTitle}</b>
        </span>
        <span>
          今日 <b>{todayFormat.format(new Date())}</b>
        </span>
      </div>
      <div className="panel-body">
        <button type="button" onClick={() => changePanel({ indexOpen: true })}>
          画面の一覧 <kbd>Ctrl</kbd>+<kbd>K</kbd>
        </button>
        <FlowCard state={state} model={model} />
        <PageCard summaries={summaries} pathname={pathname} model={model} />
        {state.course !== undefined && state.flow !== undefined && state.flow.name === state.course.flowName ? (
          <CourseCard state={state} flow={state.flow} model={model} />
        ) : (
          <StatusBox state={state} />
        )}
      </div>
      {state.indexOpen ? <ScreenIndex summaries={summaries} model={model} /> : null}
    </>
  )
}

/** 開発パネルの根。閉じているときは、右の端に開くためのつまみだけを出す。 */
export function PanelView() {
  const state = usePanel()
  const blocker = state.status.kind === 'running' ? <div className="blocker" title="業務フローの段を流しています" /> : null
  if (!state.panelOpen) {
    return (
      <div className="root">
        {blocker}
        <button type="button" className="opener" onClick={() => changePanel({ panelOpen: true })}>
          開発パネル
        </button>
        {state.indexOpen && state.model !== undefined ? <ScreenIndex summaries={summarizePages(state.model, readNavigationPaths())} model={state.model} /> : null}
      </div>
    )
  }
  return (
    <div className="root">
      {blocker}
      <aside className="panel" aria-label="開発パネル">
        <div className="panel-head">
          <strong>開発パネル</strong>
          <span className="small" style={{ opacity: 0.75 }}>
            モック（メモリの DB）
          </span>
          <span className="grow" />
          <button type="button" onClick={() => changePanel({ panelOpen: false })} title="畳む">
            ⟩
          </button>
        </div>
        {state.model === undefined ? <p className="panel-body muted">モデルを読んでいます…</p> : <PanelContent state={state} model={state.model} />}
      </aside>
    </div>
  )
}
