// 開発パネルの状態と操作。業務フローの段を「ここまで進める」「見せる」「入れる」「流す」。
// DB はモックのサーバーにあるので、DB を作り直したら画面を読み込み直す（画面の取得の覚えを捨てる）。
// 読み込み直したあとに続ける段は sessionStorage に置き、読み込んだ開発パネルが続きを流す。
import { listFlowPaths, type Flow, type FlowPath, type PathAction } from '@app/flow'
import { screen as documentScreen } from '@testing-library/dom'
import { useSyncExternalStore } from 'react'
import { mockPaths, type MockModel, type MockState, type StateRequest, type TodayRequest } from '../mockState'
import { describeCall, fillAction, openActionPage, prepareMockScreen, recordCalls, runAction, translateScenario, type HighlightElement, type OperateAction } from './flowRunner'
import { settleScreen } from './requestWatch'
import { assignClockOffset } from './shiftedClock'

/** いま見ている業務フローの経路と、次に流す段（経路の段の並びの位置）。 */
export type Course = { readonly flowName: string; readonly pathKey: string; readonly position: number }

export type RunStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running'; readonly caption: string; readonly done: number; readonly total: number }
  | { readonly kind: 'failed'; readonly caption: string; readonly message: string }

export type PanelState = {
  readonly mockState: MockState
  readonly browserOrigin: string
  readonly model: MockModel | undefined
  readonly flow: Flow<unknown> | undefined
  readonly course: Course | undefined
  readonly status: RunStatus
  readonly panelOpen: boolean
  readonly indexOpen: boolean
}

/** 読み込み直したあとに流す段（「ここまで進める」）。 */
type PendingRun = { readonly flowName: string; readonly pathKey: string; readonly number: string }

const courseKey = 'mock-course'
const pendingKey = 'mock-pending'
const panelKey = 'mock-panel-open'
const quietKey = 'mock-quiet-start'

const flowFiles = import.meta.glob<Readonly<Record<string, unknown>>>(['../../flow/**/*.ts', '!../../flow/**/*.test.ts'])

function readStorage<Value>(storage: Storage, key: string): Value | undefined {
  try {
    const value = storage.getItem(key)
    return value === null ? undefined : (JSON.parse(value) as Value)
  } catch {
    return undefined
  }
}

function saveStorage(storage: Storage, key: string, value: unknown): void {
  try {
    if (value === undefined) {
      storage.removeItem(key)
    } else {
      storage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // 保存できないブラウザ（プライベートブラウズなど）でも、開発パネルは動かす。
  }
}

function readMeta(name: string): string {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? ''
}

const firstMockState = JSON.parse(readMeta('mock-state') || '{"flowName":null,"clockOffset":0}') as MockState
assignClockOffset(firstMockState.clockOffset)
const savedCourse = readStorage<Course>(sessionStorage, courseKey)

let panelState: PanelState = {
  mockState: firstMockState,
  browserOrigin: readMeta('mock-browser-origin'),
  model: undefined,
  flow: undefined,
  course:
    firstMockState.flowName === null
      ? undefined
      : savedCourse?.flowName === firstMockState.flowName
        ? savedCourse
        : { flowName: firstMockState.flowName, pathKey: 'main', position: 0 },
  status: { kind: 'idle' },
  panelOpen: readStorage<boolean>(localStorage, panelKey) ?? true,
  indexOpen: false,
}
const listeners = new Set<() => void>()

function subscribePanel(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 開発パネルの状態を変え、画面（React）とほかの購読者に知らせる。 */
export function changePanel(change: Partial<PanelState>): void {
  panelState = { ...panelState, ...change }
  if ('course' in change) {
    saveStorage(sessionStorage, courseKey, panelState.course)
  }
  if ('panelOpen' in change) {
    saveStorage(localStorage, panelKey, panelState.panelOpen)
  }
  for (const listener of listeners) {
    listener()
  }
}

export function readPanel(): PanelState {
  return panelState
}

export function usePanel(): PanelState {
  return useSyncExternalStore(subscribePanel, readPanel)
}

/** 状態が変わるたびに呼ぶ（React の外で、画面の余白などを合わせる）。 */
export function watchPanel(listener: (state: PanelState) => void): void {
  subscribePanel(() => listener(panelState))
  listener(panelState)
}

async function postJson<Body>(path: string, body: Body): Promise<MockState> {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) {
    throw new Error(`${path} が ${response.status} を返しました。`)
  }
  return (await response.json()) as MockState
}

/** 開発パネルが読むモデル（画面・業務フロー・シナリオと、見積・議事録）を読む。 */
export async function loadModel(): Promise<MockModel> {
  if (panelState.model !== undefined) {
    return panelState.model
  }
  const response = await fetch(mockPaths.model)
  const model = (await response.json()) as MockModel
  changePanel({ model })
  return model
}

function isFlow(value: unknown): value is Flow<unknown> {
  return typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'flow'
}

/** 業務フローの定義（シナリオの操作を含む）を読む。ファイルの場所はモデルから引く。 */
export async function loadFlow(flowName: string): Promise<Flow<unknown>> {
  if (panelState.flow?.name === flowName) {
    return panelState.flow
  }
  const model = await loadModel()
  const node = model.flows.find((flow) => flow.id === flowName)
  // Windows で作ったモデルは、ファイルの区切りが \ になる。
  const loadFile = node === undefined ? undefined : flowFiles[node.file.replaceAll('\\', '/').replace(/^apps\/web\//, '../../')]
  if (loadFile === undefined) {
    throw new Error(`業務フロー「${flowName}」のファイルが見つかりません。`)
  }
  const flow = Object.values(await loadFile()).find((value) => isFlow(value) && value.name === flowName)
  if (flow === undefined || !isFlow(flow)) {
    throw new Error(`業務フロー「${flowName}」がありません。`)
  }
  changePanel({ flow })
  return flow
}

/** 業務フローの経路（本線と、拡張ごと）。 */
export function listCoursePaths(flow: Flow<unknown>): readonly FlowPath[] {
  return listFlowPaths(flow)
}

function findPath(flow: Flow<unknown>, pathKey: string): FlowPath {
  const paths = listFlowPaths(flow)
  return paths.find((path) => path.key === pathKey) ?? (paths[0] as FlowPath)
}

/** 段の見出し（「受注を登録する」「受注日になる（2026-11-24）」）。 */
export function describeAction(action: PathAction, model: MockModel | undefined): string {
  if (action.kind === 'operate') {
    return model?.scenarios.find((scenario) => scenario.id === action.scenario.name)?.title ?? translateScenario(action.scenario.name)
  }
  if (action.kind === 'elapse') {
    return `${action.date} になる`
  }
  if (action.step.kind === 'outside' || action.step.kind === 'occur') {
    return translateScenario(action.step.name)
  }
  return action.number
}

async function assignToday(date: string): Promise<void> {
  const mockState = await postJson<TodayRequest>(mockPaths.today, { date })
  assignClockOffset(mockState.clockOffset)
  changePanel({ mockState })
}

/** 業務フローの事前条件の行で DB を作り直し、画面を最初のページから読み込み直す。null なら空の DB。 */
export async function startFlow(flowName: string | null, pathKey = 'main'): Promise<void> {
  await postJson<StateRequest>(mockPaths.state, { flowName })
  assignClockOffset(0)
  saveStorage(sessionStorage, quietKey, true)
  changePanel({ course: flowName === null ? undefined : { flowName, pathKey, position: 0 } })
  window.location.assign('/')
}

/** その段の手前まで流した状態にする（DB を作り直し、読み込み直してから、前の段を順に流す）。 */
export async function advanceCourse(flowName: string, pathKey: string, number: string): Promise<void> {
  saveStorage(sessionStorage, pendingKey, { flowName, pathKey, number } satisfies PendingRun)
  await startFlow(flowName, pathKey)
}

let highlightElement: HighlightElement | undefined

/** 「見せる」で操作する要素を見せる関数（開発パネルの画面が持つ）。 */
export function registerHighlight(highlight: HighlightElement): void {
  highlightElement = highlight
}

function reportFailure(caption: string, error: unknown): void {
  const message = error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error)
  changePanel({ status: { kind: 'failed', caption, message } })
}

/** 時の経過は今日を変えて進み、システムの外の段は飛ばして、次に画面を操作する段まで進める。 */
async function skipPassive(actions: readonly PathAction[], position: number): Promise<number> {
  let next = position
  while (next < actions.length && actions[next]?.kind !== 'operate') {
    const action = actions[next] as PathAction
    if (action.kind === 'elapse') {
      await assignToday(action.date)
    }
    next += 1
  }
  return next
}

/**
 * いまの業務フローの定義を読む。始めたばかり（最初の段）なら、時の経過・システムの外の段を進めて、最初に画面を操作する段で待つ
 * （業務フローの最初が「受注日になる」なら、今日をその日にする）。
 */
export async function skipOpening(): Promise<void> {
  const { course } = panelState
  if (course === undefined) {
    return
  }
  const flow = await loadFlow(course.flowName)
  if (course.position !== 0) {
    return
  }
  const position = await skipPassive(findPath(flow, course.pathKey).actions, 0)
  changePanel({ course: { ...course, position } })
}

/** 開発パネルで業務フローを選び直して読み込み直したところか（画面の一覧を開かない）。読んだら消す。 */
export function consumeQuietStart(): boolean {
  const quiet = readStorage<boolean>(sessionStorage, quietKey) ?? false
  saveStorage(sessionStorage, quietKey, undefined)
  return quiet
}

/** 「ここまで進める」で読み込み直したところか（続きの段がある）。 */
export function hasPendingRun(): boolean {
  return readStorage<PendingRun>(sessionStorage, pendingKey) !== undefined
}

/** 読み込み直す前に頼まれた「ここまで進める」の続き。画面が出てから、前の段を順に流す。 */
export async function resumePending(): Promise<void> {
  const pending = readStorage<PendingRun>(sessionStorage, pendingKey)
  saveStorage(sessionStorage, pendingKey, undefined)
  if (pending === undefined || pending.flowName !== panelState.mockState.flowName) {
    return
  }
  const model = await loadModel()
  const flow = await loadFlow(pending.flowName)
  const path = findPath(flow, pending.pathKey)
  const target = Math.max(0, path.actions.findIndex((action) => action.number === pending.number))
  await documentScreen.findByRole('navigation', { hidden: true }, { timeout: 15_000 })
  const screen = prepareMockScreen({ settle: settleScreen })
  let caption = ''
  let position = target
  try {
    for (const [index, action] of path.actions.slice(0, target).entries()) {
      position = index
      caption = `${action.number}. ${describeAction(action, model)}`
      changePanel({ status: { kind: 'running', caption, done: index, total: target } })
      const pendingAt = await runAction(action, screen, assignToday)
      if (pendingAt !== undefined) {
        throw new Error(`未着手のシナリオです（${pendingAt}）。`)
      }
    }
    position = target
    const targetAction = path.actions[target]
    if (targetAction?.kind === 'operate') {
      caption = `${targetAction.number}. ${describeAction(targetAction, model)}`
      await openActionPage(targetAction, screen)
    }
    changePanel({ course: { flowName: pending.flowName, pathKey: path.key, position: target }, status: { kind: 'idle' } })
  } catch (error) {
    // 止まった段をいまの段にする（その段を見せる・流すで、もう一度試せる）。
    changePanel({ course: { flowName: pending.flowName, pathKey: path.key, position } })
    reportFailure(caption, error)
  }
}

type CurrentMode = 'show' | 'run' | 'fill'

/** いまの段を、見せる（ゆっくり・操作する要素を光らせて）・流す・入れる（最後のボタンは押さない）。 */
export async function operateCurrent(mode: CurrentMode): Promise<void> {
  const { course } = panelState
  if (course === undefined) {
    return
  }
  const model = await loadModel()
  const flow = await loadFlow(course.flowName)
  const path = findPath(flow, course.pathKey)
  const action = path.actions[course.position]
  if (action === undefined) {
    return
  }
  const caption = `${action.number}. ${describeAction(action, model)}`
  changePanel({ status: { kind: 'running', caption, done: 0, total: 1 } })
  try {
    if (mode === 'fill') {
      if (action.kind === 'operate') {
        await fillAction(action, prepareMockScreen({ settle: settleScreen }))
      }
      changePanel({ status: { kind: 'idle' } })
      return
    }
    const screen = prepareMockScreen({ highlight: mode === 'show' ? highlightElement : undefined, settle: settleScreen })
    const pendingAt = await runAction(action, screen, assignToday)
    if (pendingAt !== undefined) {
      throw new Error(`未着手のシナリオです（${pendingAt}）。`)
    }
    const position = await skipPassive(path.actions, course.position + 1)
    changePanel({ course: { ...course, position }, status: { kind: 'idle' } })
  } catch (error) {
    reportFailure(caption, error)
  } finally {
    highlightElement?.(document.body, '')
  }
}

/** シナリオの段の操作を、画面の言葉の文の並びにする（開発パネルに、何をする段かを出す）。 */
export async function describeOperations(action: OperateAction): Promise<readonly string[]> {
  return (await recordCalls(action)).map(describeCall)
}
