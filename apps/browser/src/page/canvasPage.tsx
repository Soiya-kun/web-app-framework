// キャンバス。画面の外まで広がる領域に業務フローのフレームを並べ、ドラッグで動かし、Ctrl（⌘）＋ホイールで拡大・縮小する。
// フレームの段を押すと、その下にシナリオのカードが開き、カードの中の処理・SQL・テーブルを押すと右へ開いていく。
// 視点・フレームの位置と開閉・開いたカードはブラウザに保存し、次に開いたときに戻す。
import { Link } from '@tanstack/react-router'
import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref } from 'react'
import { CanvasActionProvider, type CanvasAction } from '../canvas/canvasAction'
import { CanvasSearch, type SearchTarget } from '../canvas/canvasSearch'
import {
  CanvasStoreProvider,
  findBrowserStorage,
  openBranch,
  prepareCanvasStore,
  updateFrame,
  useCanvasState,
  type CanvasStore,
  type CanvasView,
} from '../canvas/canvasStore'
import { FlowFrame } from '../canvas/flowFrame'
import { arrangeFlowAreas, sumPendingSteps } from '../component/flowArea'
import { LocaleToggle } from '../component/part'
import { FitIcon, MinusIcon, PlusIcon } from '../canvas/icon'
import { CanvasMinimap, type FrameArea } from '../canvas/minimap'
import { useModel } from '../model'
import { useText, useLabelFormat } from '../text'

const minimumScale = 0.1
const maximumScale = 2.5
const toolbarHeight = 88
const panelWidth = 272
const initialView: CanvasView = { left: panelWidth + 24, top: toolbarHeight, scale: 1 }

function clampScale(scale: number): number {
  return Math.min(maximumScale, Math.max(minimumScale, scale))
}

/** 画面の点（pointLeft, pointTop）を動かさずに、倍率を変える。 */
function zoomFromPoint(view: CanvasView, pointLeft: number, pointTop: number, scale: number): CanvasView {
  const nextScale = clampScale(scale)
  const ratio = nextScale / view.scale
  return { left: pointLeft - (pointLeft - view.left) * ratio, top: pointTop - (pointTop - view.top) * ratio, scale: nextScale }
}

/** 領域が、ツールバーと左のパネルを除いた画面に収まる見え方。 */
function fitArea(area: FrameArea, viewportWidth: number, viewportHeight: number, scaleLimit: number): CanvasView {
  const usableWidth = viewportWidth - panelWidth - 48
  const usableHeight = viewportHeight - toolbarHeight - 48
  const scale = clampScale(Math.min(scaleLimit, usableWidth / area.width, usableHeight / area.height))
  return {
    left: panelWidth + 24 + (usableWidth - area.width * scale) / 2 - area.left * scale,
    top: toolbarHeight - area.top * scale,
    scale,
  }
}

function joinAreas(areas: readonly FrameArea[]): FrameArea | undefined {
  if (areas.length === 0) {
    return undefined
  }
  const left = Math.min(...areas.map((area) => area.left))
  const top = Math.min(...areas.map((area) => area.top))
  return {
    left,
    top,
    width: Math.max(...areas.map((area) => area.left + area.width)) - left,
    height: Math.max(...areas.map((area) => area.top + area.height)) - top,
  }
}

/** 段の番号を、レーン図の段と、拡張の中の段に分ける（5a.1 → 5 と 5a.1）。 */
function splitStepNumber(number: string): { readonly base: string; readonly following: string | null } {
  const extension = /^([\d.]*\d)[a-z]/.exec(number)
  return extension?.[1] === undefined ? { base: number, following: null } : { base: extension[1], following: number }
}

/**
 * フレームを並べた板（キャンバスの中身）。視点が変わっても描き直さない。
 * 業務の領域（請求・入金など）ごとに列にし、列の中に業務フローのフレームを縦に積む。
 */
const CanvasBoard = memo(function CanvasBoard({ registerFrame }: { readonly registerFrame: (flowId: string) => Ref<HTMLDivElement> }) {
  const { model } = useModel()
  return (
    <div className="flex w-max items-start gap-32 p-12">
      {arrangeFlowAreas(model.flows).map((area) => (
        <section key={area.id} aria-label={area.title} className="flex flex-col items-start gap-12">
          <h2 className="px-1 text-7xl font-bold text-muted/70">{area.title}</h2>
          {area.flows.map((flow) => (
            <FlowFrame key={flow.id} flow={flow} initialFolded={flow.parentIds.length > 0} attachFrame={registerFrame(flow.id)} />
          ))}
        </section>
      ))}
    </div>
  )
})

export function CanvasPage() {
  const [store] = useState(() => prepareCanvasStore(findBrowserStorage()))
  return (
    <CanvasStoreProvider value={store}>
      <CanvasScreen store={store} />
    </CanvasStoreProvider>
  )
}

function CanvasScreen({ store }: { readonly store: CanvasStore }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { model, scenarios } = useModel()
  const view = useCanvasState((state) => state.view) ?? initialView
  const [animated, setAnimated] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [frameAreas, setFrameAreas] = useState<ReadonlyMap<string, FrameArea>>(new Map())
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const viewportElement = useRef<HTMLDivElement | null>(null)
  const boardElement = useRef<HTMLDivElement | null>(null)
  const searchInput = useRef<HTMLInputElement | null>(null)
  const frameElements = useRef(new Map<string, HTMLDivElement>())
  const sizeObserver = useRef<ResizeObserver | null>(null)
  const dragOrigin = useRef<{
    readonly pointerId: number
    readonly pointerLeft: number
    readonly pointerTop: number
    readonly view: CanvasView
  } | null>(null)
  const spacePressed = useRef(false)

  const setView = useCallback(
    (next: CanvasView | ((current: CanvasView) => CanvasView), lazy = true) =>
      store.update((state) => ({ ...state, view: typeof next === 'function' ? next(state.view ?? initialView) : next }), lazy),
    [store],
  )

  const measureViewport = () => ({ width: viewportElement.current?.clientWidth ?? 0, height: viewportElement.current?.clientHeight ?? 0 })

  /** フレームの、自動の配置での領域（offset* は transform を含まない）。 */
  const measureFrames = useCallback(() => {
    const areas = new Map<string, FrameArea>()
    for (const [flowId, element] of frameElements.current) {
      areas.set(flowId, { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight })
    }
    return areas
  }, [])

  /** ドラッグでずらした分を含めた、フレームの領域。 */
  const measureDraggedFrame = (flowId: string): FrameArea | undefined => {
    const area = measureFrames().get(flowId)
    const frame = store.readState().frames[flowId]
    return area === undefined ? undefined : { ...area, left: area.left + (frame?.offsetLeft ?? 0), top: area.top + (frame?.offsetTop ?? 0) }
  }

  const focusArea = (area: FrameArea | undefined, scaleLimit: number) => {
    const { width, height } = measureViewport()
    if (area === undefined || width === 0 || area.width === 0) {
      return
    }
    setAnimated(true)
    setView(fitArea(area, width, height, scaleLimit))
  }

  const focusFrame = (flowId: string) => focusArea(measureDraggedFrame(flowId), 1)

  const focusBoard = () => focusArea(joinAreas([...measureFrames().keys()].flatMap((flowId) => measureDraggedFrame(flowId) ?? [])), 1)

  /** カード（data-path）が画面に収まるように動かす。描き終わってから測る。 */
  const focusCard = (flowId: string, path: string) => {
    window.requestAnimationFrame(() => {
      const board = boardElement.current
      const card = [...(frameElements.current.get(flowId)?.querySelectorAll<HTMLElement>('[data-path]') ?? [])].find(
        (element) => element.dataset['path'] === path,
      )
      if (board === null || card === undefined) {
        return
      }
      const boardRectangle = board.getBoundingClientRect()
      const cardRectangle = card.getBoundingClientRect()
      const renderedScale = board.offsetWidth === 0 ? 1 : boardRectangle.width / board.offsetWidth
      focusArea(
        {
          left: (cardRectangle.left - boardRectangle.left) / renderedScale,
          top: (cardRectangle.top - boardRectangle.top) / renderedScale - 40,
          width: cardRectangle.width / renderedScale,
          height: Math.min(cardRectangle.height / renderedScale + 40, 900),
        },
        1,
      )
    })
  }

  const zoomFromCenter = (scale: number) => {
    const { width, height } = measureViewport()
    setAnimated(true)
    setView((current) => zoomFromPoint(current, width / 2, height / 2, scale))
  }

  /** 探したものの段を開いて、そのカードへ寄せる。シナリオは最初に使う業務フローの段で開く。 */
  const openTarget = (target: SearchTarget) => {
    if (target.kind === 'flow') {
      updateFrame(store, target.flowId, (frame) => ({ ...frame, folded: false }))
      window.requestAnimationFrame(() => focusFrame(target.flowId))
      return
    }
    const scenarioId =
      target.kind === 'scenario' ? target.scenarioId : model.scenarios.find((scenario) => scenario.workIds.includes(target.workId))?.id
    const use = scenarioId === undefined ? undefined : scenarios.get(scenarioId)?.usedIn[0]
    if (use === undefined) {
      return
    }
    const { base, following } = splitStepNumber(use.number)
    updateFrame(store, use.flowId, (frame) => ({
      ...frame,
      folded: false,
      openedSteps: frame.openedSteps.includes(base) ? frame.openedSteps : [...frame.openedSteps, base],
    }))
    const basePath = `${use.flowId}:${base}`
    const scenarioPath = following === null ? basePath : `${basePath}/step:${following}`
    if (following !== null) {
      openBranch(store, basePath, `step:${following}`)
    }
    if (target.kind === 'work') {
      openBranch(store, scenarioPath, `work:${target.workId}`)
    }
    focusCard(use.flowId, target.kind === 'work' ? `${scenarioPath}/work:${target.workId}` : scenarioPath)
  }

  const resetCanvas = () => {
    store.reset()
    window.requestAnimationFrame(focusBoard)
  }

  const observeSizes = (element: Element) => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    sizeObserver.current ??= new ResizeObserver(() => {
      setFrameAreas(measureFrames())
      setViewportSize(measureViewport())
    })
    sizeObserver.current.observe(element)
  }

  const registerFrame = useCallback(
    (flowId: string) => (element: HTMLDivElement | null) => {
      if (element === null) {
        frameElements.current.delete(flowId)
        return
      }
      frameElements.current.set(flowId, element)
      observeSizes(element)
      return () => {
        sizeObserver.current?.unobserve(element)
        frameElements.current.delete(flowId)
      }
    },
    // observeSizes は ref と state の更新だけを使うので、作り直さない。
    [],
  )

  // ホイールは、ブラウザの拡大やページの移動を止めるため、passive でない聞き手で受ける（ref コールバックで付け外しする）。
  const attachViewport = useCallback(
    (element: HTMLDivElement | null) => {
      viewportElement.current = element
      if (element === null) {
        return
      }
      const receiveWheel = (event: WheelEvent) => {
        event.preventDefault()
        setAnimated(false)
        if (event.ctrlKey || event.metaKey) {
          const rectangle = element.getBoundingClientRect()
          const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0025))
          setView((current) =>
            zoomFromPoint(current, event.clientX - rectangle.left, event.clientY - rectangle.top, current.scale * factor),
          )
          return
        }
        setView((current) => ({ ...current, left: current.left - event.deltaX, top: current.top - event.deltaY }))
      }
      element.addEventListener('wheel', receiveWheel, { passive: false })
      observeSizes(element)
      setViewportSize({ width: element.clientWidth, height: element.clientHeight })
      // 保存した視点がなければ、最上位の業務フローのフレームが画面に収まるようにする。
      const firstFrame = [...frameElements.current.values()][0]
      if (store.readState().view === null && firstFrame !== undefined && element.clientWidth > 0 && firstFrame.offsetWidth > 0) {
        setView(
          fitArea(
            { left: firstFrame.offsetLeft, top: firstFrame.offsetTop, width: firstFrame.offsetWidth, height: firstFrame.offsetHeight },
            element.clientWidth,
            element.clientHeight,
            1,
          ),
          false,
        )
      }
      return () => element.removeEventListener('wheel', receiveWheel)
    },
    [store, setView],
  )

  // Ctrl（⌘）＋K で探す欄へ。画面のどこにフォーカスがあっても受ける。
  const attachRoot = useCallback((element: HTMLDivElement | null) => {
    if (element === null) {
      return
    }
    const receiveKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInput.current?.focus()
      }
    }
    window.addEventListener('keydown', receiveKey)
    return () => window.removeEventListener('keydown', receiveKey)
  }, [])

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element
    const onCard = target.closest('[data-card], button, a, input') !== null
    if (event.button === 1 || spacePressed.current || (event.button === 0 && !onCard)) {
      dragOrigin.current = { pointerId: event.pointerId, pointerLeft: event.clientX, pointerTop: event.clientY, view }
      setAnimated(false)
      setDragging(true)
      if ('setPointerCapture' in event.currentTarget) {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    }
  }

  const followDrag = (event: PointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current
    if (origin === null || origin.pointerId !== event.pointerId) {
      return
    }
    setView({
      ...origin.view,
      left: origin.view.left + event.clientX - origin.pointerLeft,
      top: origin.view.top + event.clientY - origin.pointerTop,
    })
  }

  const finishDrag = () => {
    dragOrigin.current = null
    setDragging(false)
  }

  const pressKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 80
    const shifts: Readonly<Record<string, readonly [number, number]>> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    const shift = shifts[event.key]
    if (shift !== undefined) {
      event.preventDefault()
      setAnimated(true)
      setView((current) => ({ ...current, left: current.left + shift[0], top: current.top + shift[1] }))
    }
    if (event.key === '+' || event.key === '=') {
      zoomFromCenter(view.scale * 1.25)
    }
    if (event.key === '-') {
      zoomFromCenter(view.scale / 1.25)
    }
    if (event.key === '0') {
      zoomFromCenter(1)
    }
    if (event.key === '!' || (event.key === '1' && event.shiftKey)) {
      focusBoard()
    }
    if (event.key === ' ') {
      spacePressed.current = true
    }
  }

  // フレームの中の部品が使う口。視点の値は store から読むので、描き直さなくてよい。
  const latestAction = useRef<CanvasAction>({ focusFrame: () => undefined, readScale: () => 1 })
  latestAction.current = { focusFrame, readScale: () => store.readState().view?.scale ?? 1 }
  const action = useMemo<CanvasAction>(
    () => ({ focusFrame: (flowId) => latestAction.current.focusFrame(flowId), readScale: () => latestAction.current.readScale() }),
    [],
  )
  const board = useMemo(() => <CanvasBoard registerFrame={registerFrame} />, [registerFrame])
  const flowAreas = useMemo(() => arrangeFlowAreas(model.flows), [model.flows])
  const { progress } = model

  return (
    <CanvasActionProvider value={action}>
      <div ref={attachRoot} className="relative h-screen w-screen overflow-clip bg-board">
        <div
          ref={attachViewport}
          role="application"
          aria-label={text.label('canvas')}
          tabIndex={0}
          onPointerDown={beginDrag}
          onPointerMove={followDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={pressKey}
          onKeyUp={(event) => {
            if (event.key === ' ') {
              spacePressed.current = false
            }
          }}
          // 中のボタンを押してもブラウザがスクロールで寄せないように、overflow は clip にする（視点は transform だけで動かす）。
          className={`absolute inset-0 overflow-clip outline-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{
            backgroundImage: 'radial-gradient(circle, var(--color-dot) 1px, transparent 1.2px)',
            backgroundSize: `${24 * view.scale}px ${24 * view.scale}px`,
            backgroundPosition: `${view.left}px ${view.top}px`,
          }}
        >
          <div
            ref={boardElement}
            className={`absolute left-0 top-0 origin-top-left ${animated ? 'transition-transform duration-300 ease-out' : ''}`}
            style={{ transform: `translate(${view.left}px, ${view.top}px) scale(${view.scale})` }}
          >
            {board}
          </div>
        </div>

        <header className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-surface px-2 py-1.5 text-sm shadow-[var(--shadow-float)]">
            <span className="px-2 font-bold">{text.label('codeBrowser')}</span>
            <nav className="flex items-center gap-1">
              <span className="rounded-lg bg-select/10 px-2.5 py-1 font-medium text-select">{text.label('canvas')}</span>
              <Link to="/list" className="rounded-lg px-2.5 py-1 text-muted hover:bg-canvas hover:text-ink">
                {text.label('overview')}
              </Link>
              <Link to="/meetings" className="rounded-lg px-2.5 py-1 text-muted hover:bg-canvas hover:text-ink">
                {text.label('minutes')}
              </Link>
              <Link to="/glossary" className="rounded-lg px-2.5 py-1 text-muted hover:bg-canvas hover:text-ink">
                {text.label('glossary')}
              </Link>
              <LocaleToggle />
            </nav>
            <CanvasSearch attachInput={searchInput} onSelect={openTarget} />
          </div>
          <div
            role="toolbar"
            aria-label={text.label('scale')}
            className="pointer-events-auto flex items-center gap-0.5 rounded-xl bg-surface p-1 shadow-[var(--shadow-float)]"
          >
            <button
              type="button"
              aria-label={text.action('shrink')}
              onClick={() => zoomFromCenter(view.scale / 1.25)}
              className="rounded-lg p-2 hover:bg-canvas"
            >
              <MinusIcon />
            </button>
            <button
              type="button"
              aria-label={text.label('scale')}
              onClick={() => zoomFromCenter(1)}
              className="w-14 rounded-lg py-1.5 text-center text-xs font-medium tabular-nums hover:bg-canvas"
            >
              {Math.round(view.scale * 100)}%
            </button>
            <button
              type="button"
              aria-label={text.action('enlarge')}
              onClick={() => zoomFromCenter(view.scale * 1.25)}
              className="rounded-lg p-2 hover:bg-canvas"
            >
              <PlusIcon />
            </button>
            <span className="mx-1 h-5 w-px bg-line" />
            <button
              type="button"
              onClick={focusBoard}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-canvas"
            >
              <FitIcon />
              {text.action('fit')}
            </button>
            <button
              type="button"
              onClick={resetCanvas}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-canvas hover:text-ink"
            >
              {text.action('reset')}
            </button>
          </div>
        </header>

        <aside
          aria-label={text.label('layer')}
          className="absolute left-4 top-20 flex max-h-[calc(100%-9rem)] w-60 flex-col gap-4 overflow-y-auto rounded-xl bg-surface p-3 text-sm shadow-[var(--shadow-float)]"
        >
          <section className="flex flex-col gap-1">
            <h2 className="px-1 text-xs font-bold text-muted">{text.label('flow')}</h2>
            {flowAreas.map((area) => (
              <div key={area.id} className="flex flex-col">
                <h3 className="px-2 pb-0.5 pt-1 text-[11px] font-bold text-muted">{area.title}</h3>
                {area.flows.map((flow) => {
                  const pendingCount = sumPendingSteps(flow, scenarios)
                  return (
                    <button
                      key={flow.id}
                      type="button"
                      onClick={() => openTarget({ kind: 'flow', flowId: flow.id })}
                      className={`flex items-center justify-between gap-2 rounded-md py-1 pr-2 text-left hover:bg-canvas ${flow.parentIds.length === 0 ? 'pl-3 font-medium' : 'pl-6 text-muted hover:text-ink'}`}
                    >
                      <span>{flow.title}</span>
                      {pendingCount === 0 ? null : (
                        <span className="shrink-0 rounded-full bg-pending px-1.5 text-[10px] font-normal text-pending-line">
                          {text.label('pending')} {pendingCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </section>
          <section className="flex flex-col gap-1.5">
            <h2 className="px-1 text-xs font-bold text-muted">{text.label('progress')}</h2>
            <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 px-1 text-xs">
              {[
                [text.label('scenario'), progress.scenarios, progress.pendingScenarios],
                [text.label('extension'), progress.extensions, progress.pendingExtensions],
                [text.label('case'), progress.cases, progress.pendingCases],
              ].map(([labelText, total, pending]) => (
                <div key={String(labelText)} className="contents">
                  <dt className="text-muted">{labelText}</dt>
                  <dd className="text-right tabular-nums">
                    {total}
                    {pending === 0 ? (
                      ''
                    ) : (
                      <span className="text-pending-line">{labelFormat.formatNote(`${text.label('pending')} ${pending}`)}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {model.problems.length === 0 ? null : (
              <Link to="/list" className="rounded-md bg-pending px-2 py-1 text-xs text-pending-line">
                {text.label('ruleProblem')} {model.problems.length}
              </Link>
            )}
          </section>
        </aside>

        <div className="absolute bottom-4 right-4">
          <CanvasMinimap
            frameAreas={frameAreas}
            view={view}
            viewportWidth={viewportSize.width}
            viewportHeight={viewportSize.height}
            onPoint={(pointLeft, pointTop) => {
              setAnimated(false)
              setView((current) => ({
                ...current,
                left: viewportSize.width / 2 - pointLeft * current.scale,
                top: viewportSize.height / 2 - pointTop * current.scale,
              }))
            }}
          />
        </div>

        <p className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-surface/90 px-3 py-1.5 text-xs text-muted shadow-sm">
          {text.message('canvasGuide')}
        </p>
      </div>
    </CanvasActionProvider>
  )
}
