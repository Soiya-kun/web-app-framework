// キャンバスに置く業務フローのフレーム。上に担当ごとのレーン図を出し、段を押すと、その下にカードを開く。
// 開いたカードは、右の段のものほど上に並べる。こうすると、下のカードへの線（レール）が上のカードと重ならない。
import type { FlowNode, FlowStepNode } from '@app/translator/model-types'
import { useState, type Ref } from 'react'
import { kindLabel, laneSize, arrangeLanes } from '../component/laneLayout'
import { useModel } from '../model'
import { text } from '../text'
import { ChevronIcon } from './icon'
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

function toggleItem(items: readonly string[], item: string): readonly string[] {
  return items.includes(item) ? items.filter((current) => current !== item) : [...items, item]
}

export function FlowFrame({
  flow,
  initialFolded,
  attachFrame,
}: {
  readonly flow: FlowNode
  readonly initialFolded: boolean
  readonly attachFrame: Ref<HTMLDivElement>
}) {
  const table = useModel()
  const [folded, setFolded] = useState(initialFolded)
  const [openedNests, setOpenedNests] = useState<readonly string[]>([])
  const [openedSteps, setOpenedSteps] = useState<readonly string[]>([])
  const layout = arrangeLanes(table, flow, (number) => openedNests.includes(number))
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
    <div ref={attachFrame} className="flex w-max flex-col gap-2">
      <button
        type="button"
        aria-expanded={!folded}
        onClick={() => setFolded((current) => !current)}
        className="flex items-center gap-1.5 self-start rounded-md px-1 text-sm font-medium text-muted hover:text-ink"
      >
        <ChevronIcon opened={!folded} />
        <span className="font-bold text-ink">{flow.title}</span>
        <span className="text-xs">
          {flow.parentIds.length === 0 ? text.label('summary') : text.label('childFlow')}・{text.label('step')} {flow.steps.length}・
          {text.label('scenario')} {scenarioCount}
          {pendingCount === 0 ? '' : `・${text.label('pending')} ${pendingCount}`}
        </span>
      </button>
      <section
        aria-label={flow.title}
        data-card
        className="flex flex-col overflow-hidden rounded-xl border border-line/70 bg-surface shadow-[var(--shadow-card)]"
        style={{ minWidth: folded ? 360 : laneSize.label + layout.width }}
      >
        <div
          className="flex flex-col gap-1 border-b border-line/60 px-4 py-3 text-[13px]"
          style={{ maxWidth: Math.max(360, laneSize.label + layout.width) }}
        >
          <p>{flow.purpose}</p>
          {flow.precondition === null ? null : (
            <p className="text-xs text-muted">
              {text.label('precondition')}: {flow.precondition}
            </p>
          )}
        </div>
        {folded ? null : (
          <figure aria-label={`${flow.title}の${text.label('laneDiagram')}`} className="relative flex" style={{ height: layout.height }}>
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
                  onClick={() => setOpenedNests((current) => toggleItem(current, group.number))}
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
                        ? setOpenedNests((current) => toggleItem(current, laneStep.number))
                        : setOpenedSteps((current) => toggleItem(current, laneStep.number))
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
                      {laneStep.number}・{kindLabel[step.kind]}
                      {laneStep.pending ? `・${text.label('pending')}` : ''}
                      {step.extensions.length > 0 ? `・${text.label('extension')}` : ''}
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
                    {row.step.kind === 'operate' ? <ScenarioCard step={row.step} /> : <NoteCard step={row.step} />}
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
