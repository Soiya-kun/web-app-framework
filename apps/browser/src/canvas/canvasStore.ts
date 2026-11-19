// キャンバスの状態（視点・フレームの位置と開閉・開いたカード・折りたたみ）を1か所に持ち、ブラウザに保存する。
// 次に開いたときも、同じところから続けられる。保存できない環境（プライベートなど）でも、保存しないだけで動く。
import { createContext, use, useSyncExternalStore } from 'react'

export type CanvasView = { readonly left: number; readonly top: number; readonly scale: number }

export type FrameState = {
  /** 自動の配置からずらした量（ドラッグで動かした分）。 */
  readonly offsetLeft: number
  readonly offsetTop: number
  /** null は最初の開閉のまま（最上位は開き、子フローは閉じる）。 */
  readonly folded: boolean | null
  readonly openedNests: readonly string[]
  readonly openedSteps: readonly string[]
}

export type CanvasState = {
  /** null は、まだ一度も動かしていない（最初のフレームに合わせる）。 */
  readonly view: CanvasView | null
  readonly frames: Readonly<Record<string, FrameState>>
  /** カードの道筋 → 右に開いた子のカード（work:…・statement:…・table:…・step:…）。 */
  readonly branches: Readonly<Record<string, readonly string[]>>
  /** 折りたたみの道筋 → 開いているか。 */
  readonly folds: Readonly<Record<string, boolean>>
}

export type CanvasStore = {
  readState(): CanvasState
  subscribe(listener: () => void): () => void
  /** 状態を変える。lazy なら保存を少し待つ（視点のように何度も変わるもの）。 */
  update(change: (state: CanvasState) => CanvasState, lazy?: boolean): void
  /** 開いたカード・フレームの位置と開閉を、最初の状態に戻す（視点は残す）。 */
  reset(): void
}

const storageKey = 'web-app-framework:canvas:1'
const emptyState: CanvasState = { view: null, frames: {}, branches: {}, folds: {} }
export const emptyList: readonly string[] = []
export const emptyFrame: FrameState = { offsetLeft: 0, offsetTop: 0, folded: null, openedNests: emptyList, openedSteps: emptyList }

function readStoredState(storage: Storage | null): CanvasState {
  try {
    const stored = storage?.getItem(storageKey)
    if (stored === null || stored === undefined) {
      return emptyState
    }
    const storedValue = JSON.parse(stored) as Partial<CanvasState>
    return {
      view: storedValue.view ?? null,
      frames: storedValue.frames ?? {},
      branches: storedValue.branches ?? {},
      folds: storedValue.folds ?? {},
    }
  } catch {
    return emptyState
  }
}

/** ブラウザの保存先（使えなければ null）。 */
export function findBrowserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function prepareCanvasStore(storage: Storage | null): CanvasStore {
  let state = readStoredState(storage)
  const listeners = new Set<() => void>()
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    clearTimeout(saveTimer)
    try {
      storage?.setItem(storageKey, JSON.stringify(state))
    } catch {
      // 保存できなくても、この画面の中では動く。
    }
  }
  const notify = () => listeners.forEach((listener) => listener())
  return {
    readState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update(change, lazy = false) {
      const next = change(state)
      if (next === state) {
        return
      }
      state = next
      notify()
      if (lazy) {
        clearTimeout(saveTimer)
        saveTimer = setTimeout(save, 300)
        return
      }
      save()
    },
    reset() {
      state = { ...emptyState, view: state.view }
      notify()
      save()
    },
  }
}

const CanvasStoreContext = createContext<CanvasStore | null>(null)

export const CanvasStoreProvider = CanvasStoreContext

export function useCanvasStore(): CanvasStore {
  const store = use(CanvasStoreContext)
  if (store === null) {
    throw new Error('CanvasStoreProvider の中で使ってください。')
  }
  return store
}

/** 状態の一部を読む（変わったときだけ描き直す）。select は、変わっていなければ同じ値を返すこと。 */
export function useCanvasState<Value>(select: (state: CanvasState) => Value): Value {
  const store = useCanvasStore()
  return useSyncExternalStore(store.subscribe, () => select(store.readState()))
}

export function toggleItem(items: readonly string[], item: string): readonly string[] {
  return items.includes(item) ? items.filter((current) => current !== item) : [...items, item]
}

export function updateFrame(store: CanvasStore, flowId: string, change: (frame: FrameState) => FrameState): void {
  store.update((state) => ({ ...state, frames: { ...state.frames, [flowId]: change(state.frames[flowId] ?? emptyFrame) } }))
}

export function toggleBranch(store: CanvasStore, path: string, child: string): void {
  store.update((state) => ({ ...state, branches: { ...state.branches, [path]: toggleItem(state.branches[path] ?? emptyList, child) } }))
}

/** 子のカードを開く（開いていれば何もしない）。 */
export function openBranch(store: CanvasStore, path: string, child: string): void {
  store.update((state) =>
    (state.branches[path] ?? emptyList).includes(child)
      ? state
      : { ...state, branches: { ...state.branches, [path]: [...(state.branches[path] ?? emptyList), child] } },
  )
}
