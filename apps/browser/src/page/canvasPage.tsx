// キャンバス。画面の外まで広がる領域に業務フローのフレームを並べ、ドラッグで動かし、Ctrl（⌘）＋ホイールで拡大・縮小する。
// フレームの段を押すと、その下にシナリオのカードが開き、カードの中の処理・SQL・テーブルを押すと右へ開いていく。
import { Link } from '@tanstack/react-router'
import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref } from 'react'
import { FlowFrame } from '../canvas/flowFrame'
import { FitIcon, MinusIcon, PlusIcon } from '../canvas/icon'
import { useModel } from '../model'
import { text } from '../text'

type View = { readonly left: number; readonly top: number; readonly scale: number }
type Area = { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

const minimumScale = 0.1
const maximumScale = 2.5
const toolbarHeight = 88
const panelWidth = 272

function clampScale(scale: number): number {
  return Math.min(maximumScale, Math.max(minimumScale, scale))
}

/** 画面の点（left, top）を動かさずに、倍率を変える。 */
function zoomFromPoint(view: View, pointLeft: number, pointTop: number, scale: number): View {
  const nextScale = clampScale(scale)
  const ratio = nextScale / view.scale
  return { left: pointLeft - (pointLeft - view.left) * ratio, top: pointTop - (pointTop - view.top) * ratio, scale: nextScale }
}

/** 領域が、ツールバーと左の一覧を除いた画面に収まる見え方。 */
function fitArea(area: Area, viewportWidth: number, viewportHeight: number, scaleLimit: number): View {
  const usableWidth = viewportWidth - panelWidth - 48
  const usableHeight = viewportHeight - toolbarHeight - 48
  const scale = clampScale(Math.min(scaleLimit, usableWidth / area.width, usableHeight / area.height))
  return {
    left: panelWidth + 24 + (usableWidth - area.width * scale) / 2 - area.left * scale,
    top: toolbarHeight - area.top * scale,
    scale,
  }
}

/** フレームを並べた板（キャンバスの中身）。視点が変わっても描き直さない。 */
const CanvasBoard = memo(function CanvasBoard({ registerFrame }: { readonly registerFrame: (flowId: string) => Ref<HTMLDivElement> }) {
  const { model } = useModel()
  const frameFlows = [
    ...model.flows.filter((flow) => flow.parentIds.length === 0),
    ...model.flows.filter((flow) => flow.parentIds.length > 0),
  ]
  return (
    <div className="flex w-max items-start gap-24 p-12">
      {frameFlows.map((flow) => (
        <FlowFrame key={flow.id} flow={flow} initialFolded={flow.parentIds.length > 0} attachFrame={registerFrame(flow.id)} />
      ))}
    </div>
  )
})

export function CanvasPage() {
  const { model } = useModel()
  const [view, setView] = useState<View>({ left: panelWidth + 24, top: toolbarHeight, scale: 1 })
  const [animated, setAnimated] = useState(false)
  const [dragging, setDragging] = useState(false)
  const viewportElement = useRef<HTMLDivElement | null>(null)
  const boardElement = useRef<HTMLDivElement | null>(null)
  const frameElements = useRef(new Map<string, HTMLDivElement>())
  const dragOrigin = useRef<{
    readonly pointerId: number
    readonly pointerLeft: number
    readonly pointerTop: number
    readonly view: View
  } | null>(null)
  const spacePressed = useRef(false)
  const initialFit = useRef(false)

  const measureViewport = () => ({ width: viewportElement.current?.clientWidth ?? 0, height: viewportElement.current?.clientHeight ?? 0 })

  const focusArea = (area: Area, scaleLimit: number) => {
    const { width, height } = measureViewport()
    if (width === 0 || area.width === 0) {
      return
    }
    setAnimated(true)
    setView(fitArea(area, width, height, scaleLimit))
  }

  const focusFrame = (flowId: string) => {
    const element = frameElements.current.get(flowId)
    if (element !== undefined) {
      focusArea({ left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight }, 1)
    }
  }

  const focusBoard = () => {
    const element = boardElement.current
    if (element !== null) {
      focusArea({ left: 0, top: 0, width: element.offsetWidth, height: element.offsetHeight }, 1)
    }
  }

  const zoomFromCenter = (scale: number) => {
    const { width, height } = measureViewport()
    setAnimated(true)
    setView((current) => zoomFromPoint(current, width / 2, height / 2, scale))
  }

  const registerFrame = useCallback(
    (flowId: string) => (element: HTMLDivElement | null) => {
      if (element === null) {
        frameElements.current.delete(flowId)
      } else {
        frameElements.current.set(flowId, element)
      }
    },
    [],
  )

  // ホイールは、ブラウザの拡大やページの移動を止めるため、passive でない聞き手で受ける（ref コールバックで付け外しする）。
  const attachViewport = useCallback((element: HTMLDivElement | null) => {
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
        setView((current) => zoomFromPoint(current, event.clientX - rectangle.left, event.clientY - rectangle.top, current.scale * factor))
        return
      }
      setView((current) => ({ ...current, left: current.left - event.deltaX, top: current.top - event.deltaY }))
    }
    element.addEventListener('wheel', receiveWheel, { passive: false })
    // 最初は、最上位の業務フローのフレームが画面に収まるようにする。
    const firstFrame = [...frameElements.current.values()][0]
    if (!initialFit.current && firstFrame !== undefined && element.clientWidth > 0 && firstFrame.offsetWidth > 0) {
      initialFit.current = true
      setView(
        fitArea(
          { left: firstFrame.offsetLeft, top: firstFrame.offsetTop, width: firstFrame.offsetWidth, height: firstFrame.offsetHeight },
          element.clientWidth,
          element.clientHeight,
          1,
        ),
      )
    }
    return () => element.removeEventListener('wheel', receiveWheel)
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
    if (event.key === '1' && event.shiftKey) {
      focusBoard()
    }
    if (event.key === ' ') {
      spacePressed.current = true
    }
  }

  const board = useMemo(() => <CanvasBoard registerFrame={registerFrame} />, [registerFrame])
  const topFlows = model.flows.filter((flow) => flow.parentIds.length === 0)
  const { progress } = model

  return (
    <div className="relative h-screen w-screen overflow-clip bg-board">
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
        <nav className="pointer-events-auto flex items-center gap-1 rounded-xl bg-surface px-2 py-1.5 text-sm shadow-[var(--shadow-float)]">
          <span className="px-2 font-bold">{text.label('codeBrowser')}</span>
          <span className="rounded-lg bg-select/10 px-2.5 py-1 font-medium text-select">{text.label('canvas')}</span>
          <Link to="/list" className="rounded-lg px-2.5 py-1 text-muted hover:bg-canvas hover:text-ink">
            {text.label('overview')}
          </Link>
          <Link to="/glossary" className="rounded-lg px-2.5 py-1 text-muted hover:bg-canvas hover:text-ink">
            {text.label('glossary')}
          </Link>
        </nav>
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
        </div>
      </header>

      <aside
        aria-label={text.label('layer')}
        className="absolute left-4 top-20 flex max-h-[calc(100%-9rem)] w-60 flex-col gap-4 overflow-y-auto rounded-xl bg-surface p-3 text-sm shadow-[var(--shadow-float)]"
      >
        <section className="flex flex-col gap-1">
          <h2 className="px-1 text-xs font-bold text-muted">{text.label('flow')}</h2>
          {topFlows.map((flow) => (
            <div key={flow.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => focusFrame(flow.id)}
                className="rounded-md px-2 py-1 text-left font-medium hover:bg-canvas"
              >
                {flow.title}
              </button>
              {model.flows
                .filter((child) => child.parentIds.includes(flow.id))
                .map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => focusFrame(child.id)}
                    className="rounded-md py-1 pl-6 pr-2 text-left text-muted hover:bg-canvas hover:text-ink"
                  >
                    {child.title}
                  </button>
                ))}
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
                    <span className="text-pending-line">
                      （{text.label('pending')} {pending}）
                    </span>
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

      <p className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-surface/90 px-3 py-1.5 text-xs text-muted shadow-sm">
        {text.message('canvasGuide')}
      </p>
    </div>
  )
}
