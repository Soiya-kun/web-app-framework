// 業務フローのレーン図。担当ごとの横の帯（レーン）に、段を左から順に置き、矢印でつなぐ。
// 子フローは中を開いて並べ、上に子フローの名前の帯を出す。
import type { FlowNode, FlowStepNode } from '@app/translator/model-types'
import { Link } from '@tanstack/react-router'
import { useModel } from '../model'
import { useText, useLabelFormat } from '../text'
import { readStepKindLabels } from './kindLabel'
import { laneSize, arrangeLanes } from './laneLayout'

const boxStyle: Readonly<Record<FlowStepNode['kind'], string>> = {
  operate: 'border-primary bg-surface',
  outside: 'border-line bg-outside',
  occur: 'border-event-line bg-event',
  elapse: 'border-time-line bg-time',
  nest: 'border-line bg-surface',
}

const { column: columnWidth, boxWidth, boxHeight, lane: laneHeight, label: labelWidth, group: groupHeight } = laneSize

export function FlowDiagram({ flow }: { readonly flow: FlowNode }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const kindLabel = readStepKindLabels(text)
  const table = useModel()
  // ページのレーン図は、子フローをすべて開く。
  const { steps, groups, lanes, top, width, height, measureBoxLeft, measureBoxTop } = arrangeLanes(text, table, flow, () => true)

  return (
    <figure aria-label={labelFormat.joinItem(flow.title, text.label('laneDiagram'))} className="flex rounded-control border border-line bg-surface">
      {/* 担当の名前の列は固定し、図だけを横に動かす。 */}
      <div className="relative shrink-0 border-r border-line" style={{ width: labelWidth, height }}>
        {lanes.map(([laneKey, laneTitle], index) => (
          <div
            key={laneKey}
            className={`absolute left-0 flex w-full items-center border-b border-line px-3 text-xs font-bold text-muted ${index % 2 === 0 ? 'bg-canvas/60' : ''}`}
            style={{ top: top + index * laneHeight, height: laneHeight }}
          >
            {laneTitle}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="relative" style={{ width, height }}>
          {lanes.map(([laneKey], index) => (
            <div
              key={laneKey}
              className={`absolute left-0 border-b border-line ${index % 2 === 0 ? 'bg-canvas/60' : ''}`}
              style={{ top: top + index * laneHeight, height: laneHeight, width }}
            />
          ))}
          {groups.map((group) => (
            <Link
              key={`${group.flowId}-${group.first}`}
              to="/flow/$flowId"
              params={{ flowId: group.flowId }}
              className="absolute flex items-center rounded-control border border-dashed border-muted bg-surface px-2 text-xs font-medium text-muted hover:text-ink"
              style={{
                left: measureBoxLeft(group.first) - 8,
                width: (group.last - group.first) * columnWidth + boxWidth + 16,
                top: group.depth * groupHeight + 2,
                height: groupHeight - 4,
              }}
            >
              {text.label('childFlow')}: {group.title}
            </Link>
          ))}
          <svg className="pointer-events-none absolute left-0 top-0" width={width} height={height} aria-hidden="true">
            <defs>
              <marker id="arrowHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" className="fill-muted" />
              </marker>
            </defs>
            {steps.slice(1).map((step, index) => {
              const previous = steps[index]
              if (previous === undefined) {
                return null
              }
              const beginLeft = measureBoxLeft(index) + boxWidth
              const beginTop = measureBoxTop(previous.laneKey) + boxHeight / 2
              const endLeft = measureBoxLeft(index + 1)
              const endTop = measureBoxTop(step.laneKey) + boxHeight / 2
              const middleLeft = (beginLeft + endLeft) / 2
              return (
                <path
                  key={step.number}
                  d={`M${beginLeft},${beginTop} H${middleLeft} V${endTop} H${endLeft - 2}`}
                  className="fill-none stroke-muted"
                  strokeWidth={1.5}
                  markerEnd="url(#arrowHead)"
                />
              )
            })}
          </svg>
          {steps.map((diagramStep, index) => {
            const { step } = diagramStep
            const style = {
              left: measureBoxLeft(index),
              top: measureBoxTop(diagramStep.laneKey),
              width: boxWidth,
              height: boxHeight,
            }
            const boxBody = (
              <>
                <span className="text-[10px] text-muted">
                  {diagramStep.number}
                  {labelFormat.mark}
                  {kindLabel[step.kind]}
                  {diagramStep.pending ? `${labelFormat.mark}${text.label('pending')}` : ''}
                  {step.extensions.length > 0 ? `${labelFormat.mark}${text.label('extension')}` : ''}
                </span>
                <span className="text-xs font-medium leading-snug">{step.title}</span>
              </>
            )
            const className = `absolute flex flex-col justify-center gap-0.5 rounded-control border px-2 ${boxStyle[step.kind]} ${diagramStep.pending ? 'border-dashed border-pending-line' : ''}`
            return step.scenarioId === null ? (
              <div key={diagramStep.number} className={className} style={style}>
                {boxBody}
              </div>
            ) : (
              <Link
                key={diagramStep.number}
                to="/scenario/$scenarioId"
                params={{ scenarioId: step.scenarioId }}
                className={`${className} hover:shadow`}
                style={style}
              >
                {boxBody}
              </Link>
            )
          })}
        </div>
      </div>
    </figure>
  )
}
