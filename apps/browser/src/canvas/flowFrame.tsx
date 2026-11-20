// キャンバスに置く業務フローのフレーム。上に担当ごとのレーン図を出し、段を押すと、その下にカードを開く。
// 開いたカードは、右の段のものほど上に並べる。こうすると、下のカードへの線（レール）が上のカードと重ならない。
import type { FlowNode, FlowStepNode } from '@app/translator/model-types'
import { useRef, type PointerEvent, type Ref } from 'react'
import { readStepKindLabels } from '../component/kindLabel'
import { arrangeLanes, laneSize } from '../component/laneLayout'
import { useModel } from '../model'
import { useText, useLabelFormat } from '../text'
import { useCanvasAction } from './canvasAction'
import { emptyFrame, toggleItem, updateFrame, useCanvasState, useCanvasStore, type FrameState } from './canvasStore'
import { ChevronIcon, FitIcon } from './icon'
import { NoteCard, ScenarioCard } from './nodeCard'

const kindStyle: Readonly<Record<FlowStepNode['kind'], string>> = {
  operate: 'border-l-operate',
  outside: 'border-l-outside-mark bg-outside',
  occur: 'border-l-occur bg-event',
  elapse: 'border-l-elapse bg-time',
  nest: 'border-l-nest',
}

/** カードの左端から、レールがカードに入るところまで。 */
const railMargin = 28
/** レールがカードの上に着くまでの高さ。 */
const railHeight = 28

/** 名前の帯を、この長さより動かしたらドラッグ（それより短ければ押しただけ）。 */
const dragThreshold = 4

export function FlowFrame({
  flow,
  initialFolded,
  attachFrame,
}: {
  readonly flow: FlowNode
  readonly initialFolded: boolean
  readonly attachFrame: Ref<HTMLDivElement>
}) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const kindLabel = readStepKindLabels(text)
  const table = useModel()
  const store = useCanvasStore()
  const action = useCanvasAction()
  const frame = useCanvasState((state) => state.frames[flow.id] ?? emptyFrame)
  const folded = frame.folded ?? initialFolded
  const { openedNests, openedSteps } = frame
  const change = (next: (current: FrameState) => FrameState) => updateFrame(store, flow.id, next)
  const changeFolded = (toggle: (current: boolean) => boolean) =>
    change((current) => ({ ...current, folded: toggle(current.folded ?? initialFolded) }))
  const changeOpenedNests = (toggle: (current: readonly string[]) => readonly string[]) =>
    change((current) => ({ ...current, openedNests: toggle(current.openedNests) }))
  const changeOpenedSteps = (toggle: (current: readonly string[]) => readonly string[]) =>
    change((current) => ({ ...current, openedSteps: toggle(current.openedSteps) }))
  // 名前の帯のドラッグ。動かした量はキャンバスの倍率で割って、キャンバスの上の長さにする。
  const titleDrag = useRef<{
    readonly pointerId: number
    readonly pointerLeft: number
    readonly pointerTop: number
    readonly frame: FrameState
    dragged: boolean
  } | null>(null)
  const beginTitleDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return
    }
    titleDrag.current = { pointerId: event.pointerId, pointerLeft: event.clientX, pointerTop: event.clientY, frame, dragged: false }
    if ('setPointerCapture' in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }
  const followTitleDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = titleDrag.current
    if (drag === null || drag.pointerId !== event.pointerId) {
      return
    }
    const shiftLeft = event.clientX - drag.pointerLeft
    const shiftTop = event.clientY - drag.pointerTop
    if (!drag.dragged && Math.hypot(shiftLeft, shiftTop) < dragThreshold) {
      return
    }
    drag.dragged = true
    const scale = action.readScale()
    change((current) => ({
      ...current,
      offsetLeft: drag.frame.offsetLeft + shiftLeft / scale,
      offsetTop: drag.frame.offsetTop + shiftTop / scale,
    }))
  }
  // ドラッグで動かしたあとの click では開閉しない（押しただけ・キーボードの操作なら開閉する）。
  const draggedTitle = useRef(false)
  const finishTitleDrag = () => {
    draggedTitle.current = titleDrag.current?.dragged === true
    titleDrag.current = null
  }
  const pressTitle = () => {
    if (draggedTitle.current) {
      draggedTitle.current = false
      return
    }
    changeFolded((current) => !current)
  }
  const layout = arrangeLanes(text, table, flow, (number) => openedNests.includes(number))
  const stepIndex = new Map(layout.steps.map((laneStep, index) => [laneStep.number, index]))
  const measureRailLeft = (index: number) => laneSize.label + layout.measureBoxLeft(index) + laneSize.boxWidth / 2
  // 開いた段を、右（番号の大きい列）から順に並べる。閉じた子フローの中の段は出さない。
  const rows = openedSteps
    .flatMap((number) => {
      const index = stepIndex.get(number)
      const laneStep = index === undefined ? undefined : layout.steps[index]
      return index === undefined || laneStep === undefined ? [] : [{ number, index, step: laneStep.step }]
    })
    .sort((left, right) => right.index - left.index)
  const scenarioCount = new Set(layout.steps.flatMap((laneStep) => (laneStep.step.scenarioId === null ? [] : [laneStep.step.scenarioId])))
    .size
  const pendingCount = layout.steps.filter((laneStep) => laneStep.pending).length

  return (
    <div
      ref={attachFrame}
      data-frame={flow.id}
      className="flex w-max flex-col gap-2"
      style={{ transform: `translate(${frame.offsetLeft}px, ${frame.offsetTop}px)` }}
    >
      {/* 名前の帯: 押すと開閉、ドラッグで動かす。横の印で、このフレームを画面に収める。 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={!folded}
          onPointerDown={beginTitleDrag}
          onPointerMove={followTitleDrag}
          onPointerUp={finishTitleDrag}
          onPointerCancel={() => {
            titleDrag.current = null
          }}
          onClick={pressTitle}
          className="flex cursor-move items-center gap-1.5 self-start rounded-md px-1 text-sm font-medium text-muted hover:text-ink"
        >
          <ChevronIcon opened={!folded} />
          <span className="font-bold text-ink">{flow.title}</span>
          <span className="text-xs">
            {flow.parentIds.length === 0 ? text.label('summary') : text.label('childFlow')}
            {labelFormat.mark}
            {text.label('step')} {flow.steps.length}
            {labelFormat.mark}
            {text.label('scenario')} {scenarioCount}
            {pendingCount === 0 ? '' : `${labelFormat.mark}${text.label('pending')} ${pendingCount}`}
          </span>
        </button>
        <button
          type="button"
          aria-label={`${text.action('focus')}: ${flow.title}`}
          onClick={() => action.focusFrame(flow.id)}
          className="rounded-md p-1 text-muted hover:bg-surface hover:text-ink"
        >
          <FitIcon />
        </button>
      </div>
      <section
        aria-label={flow.title}
        data-card
        className="flex flex-col overflow-hidden rounded-xl border border-line/70 bg-surface shadow-[var(--shadow-card)]"
        style={{ minWidth: folded ? 360 : laneSize.label + layout.width }}
      >
        {flow.precondition === null ? null : (
          <p
            className="border-b border-line/60 px-4 py-3 text-xs text-muted"
            style={{ maxWidth: Math.max(360, laneSize.label + layout.width) }}
          >
            {text.label('precondition')}: {flow.precondition}
          </p>
        )}
        {folded ? null : (
          <figure aria-label={labelFormat.joinItem(flow.title, text.label('laneDiagram'))} className="relative flex" style={{ height: layout.height }}>
            <div className="relative shrink-0 border-r border-line/60" style={{ width: laneSize.label }}>
              {layout.lanes.map(([laneKey, laneTitle], index) => (
                <div
                  key={laneKey}
                  className={`absolute left-0 flex w-full items-center px-3 text-[11px] font-bold text-muted ${index % 2 === 0 ? 'bg-canvas/50' : ''}`}
                  style={{ top: layout.top + index * laneSize.lane, height: laneSize.lane }}
                >
                  {laneTitle}
                </div>
              ))}
            </div>
            <div className="relative" style={{ width: layout.width }}>
              {layout.lanes.map(([laneKey], index) => (
                <div
                  key={laneKey}
                  className={`absolute left-0 w-full ${index % 2 === 0 ? 'bg-canvas/50' : ''}`}
                  style={{ top: layout.top + index * laneSize.lane, height: laneSize.lane }}
                />
              ))}
              {layout.groups.map((group) => (
                <button
                  key={group.number}
                  type="button"
                  aria-expanded
                  onClick={() => changeOpenedNests((current) => toggleItem(current, group.number))}
                  className="absolute flex items-center gap-1 rounded-md border border-dashed border-nest bg-nest/5 px-2 text-[11px] font-medium text-nest hover:bg-nest/10"
                  style={{
                    left: layout.measureBoxLeft(group.first) - 8,
                    width: (group.last - group.first) * laneSize.column + laneSize.boxWidth + 16,
                    top: group.depth * laneSize.group + 2,
                    height: laneSize.group - 4,
                  }}
                >
                  <ChevronIcon opened />
                  {text.label('childFlow')}: {group.title}
                </button>
              ))}
              <svg className="pointer-events-none absolute left-0 top-0" width={layout.width} height={layout.height} aria-hidden="true">
                <defs>
                  <marker id={`arrowHead-${flow.id}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M0,0 L8,4 L0,8 z" className="fill-wire" />
                  </marker>
                </defs>
                {layout.steps.slice(1).map((laneStep, index) => {
                  const previous = layout.steps[index]
                  if (previous === undefined) {
                    return null
                  }
                  const beginLeft = layout.measureBoxLeft(index) + laneSize.boxWidth
                  const beginTop = layout.measureBoxTop(previous.laneKey) + laneSize.boxHeight / 2
                  const endLeft = layout.measureBoxLeft(index + 1) - 2
                  const endTop = layout.measureBoxTop(laneStep.laneKey) + laneSize.boxHeight / 2
                  const curveWidth = (endLeft - beginLeft) / 2
                  return (
                    <path
                      key={laneStep.number}
                      d={`M${beginLeft},${beginTop} C${beginLeft + curveWidth},${beginTop} ${endLeft - curveWidth},${endTop} ${endLeft},${endTop}`}
                      className="fill-none stroke-wire"
                      strokeWidth={1.5}
                      markerEnd={`url(#arrowHead-${flow.id})`}
                    />
                  )
                })}
                {rows.map((row) => {
                  const railLeft = layout.measureBoxLeft(row.index) + laneSize.boxWidth / 2
                  const laneStep = layout.steps[row.index]
                  const boxBottom = (laneStep === undefined ? 0 : layout.measureBoxTop(laneStep.laneKey)) + laneSize.boxHeight
                  return (
                    <path key={row.number} d={`M${railLeft},${boxBottom} V${layout.height}`} className="stroke-select" strokeWidth={2} />
                  )
                })}
              </svg>
              {layout.steps.map((laneStep, index) => {
                const { step } = laneStep
                const opened = openedSteps.includes(laneStep.number)
                return (
                  <button
                    key={laneStep.number}
                    type="button"
                    aria-expanded={laneStep.folded ? false : opened}
                    aria-label={`${laneStep.number} ${step.title}`}
                    onClick={() =>
                      laneStep.folded
                        ? changeOpenedNests((current) => toggleItem(current, laneStep.number))
                        : changeOpenedSteps((current) => toggleItem(current, laneStep.number))
                    }
                    className={`absolute flex flex-col justify-center gap-0.5 rounded-lg border border-l-[3px] border-line/80 bg-surface px-2 text-left shadow-sm transition-shadow hover:shadow-md ${kindStyle[step.kind]} ${
                      opened ? 'ring-2 ring-select' : ''
                    } ${laneStep.pending ? 'border-dashed border-pending-line' : ''}`}
                    style={{
                      left: layout.measureBoxLeft(index),
                      top: layout.measureBoxTop(laneStep.laneKey),
                      width: laneSize.boxWidth,
                      height: laneSize.boxHeight,
                    }}
                  >
                    <span className="text-[10px] text-muted">
                      {laneStep.number}
                      {labelFormat.mark}
                      {kindLabel[step.kind]}
                      {laneStep.pending ? `${labelFormat.mark}${text.label('pending')}` : ''}
                      {step.extensions.length > 0 ? `${labelFormat.mark}${text.label('extension')}` : ''}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium leading-snug">
                      {laneStep.folded ? <ChevronIcon opened={false} /> : null}
                      {step.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </figure>
        )}
        {folded || rows.length === 0 ? null : (
          <div className="relative pb-6">
            {rows.map((row, rowIndex) => {
              const railLeft = measureRailLeft(row.index)
              return (
                <div key={row.number} className="relative" style={{ paddingTop: railHeight }}>
                  {/* 下の行へ向かうレール（右の段のカードほど上にあるので、カードの左を通る）。 */}
                  {rows.slice(rowIndex + 1).map((followingRow) => (
                    <span
                      key={followingRow.number}
                      className="absolute bottom-0 top-0 w-0.5 bg-select"
                      style={{ left: measureRailLeft(followingRow.index) - 1 }}
                    />
                  ))}
                  <span className="absolute top-0 w-0.5 bg-select" style={{ left: railLeft - 1, height: railHeight }} />
                  <span className="absolute size-2 rounded-full bg-select" style={{ left: railLeft - 4, top: railHeight - 4 }} />
                  <div style={{ marginLeft: Math.max(8, railLeft - railMargin) }}>
                    {row.step.kind === 'operate' ? (
                      <ScenarioCard path={`${flow.id}:${row.number}`} step={row.step} />
                    ) : (
                      <NoteCard path={`${flow.id}:${row.number}`} step={row.step} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
