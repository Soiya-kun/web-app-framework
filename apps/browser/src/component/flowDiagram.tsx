// 業務フローのレーン図。担当ごとの横の帯（レーン）に、段を左から順に置き、矢印でつなぐ。
// 子フローは中を開いて並べ、上に子フローの名前の帯を出す。
import type { FlowNode, FlowStepNode } from '@app/translator/model-types'
import { Link } from '@tanstack/react-router'
import { useModel, type ModelTable } from '../model'
import { text } from '../text'

type DiagramStep = {
  readonly number: string
  readonly step: FlowStepNode
  readonly laneKey: string
  readonly laneTitle: string
  readonly pending: boolean
}

type DiagramGroup = {
  readonly flowId: string
  readonly title: string
  readonly first: number
  readonly last: number
  readonly depth: number
}

const columnWidth = 152
const boxWidth = 132
const boxHeight = 64
const laneHeight = 88
const labelWidth = 112
// 段の箱の横の余白（図の左端から最初の箱まで）。
const diagramMargin = 8
const groupHeight = 24

/** 子フローを開いて、段を1列に並べる。 */
function expandSteps(table: ModelTable, flow: FlowNode, prefix = '', depth = 0, steps: DiagramStep[] = [], groups: DiagramGroup[] = []) {
  for (const step of flow.steps) {
    const number = `${prefix}${step.number}`
    const child = step.flowId === null ? undefined : table.flows.get(step.flowId)
    if (step.kind === 'nest' && child !== undefined && depth < 3) {
      const first = steps.length
      expandSteps(table, child, `${number}.`, depth + 1, steps, groups)
      groups.push({ flowId: child.id, title: child.title, first, last: steps.length - 1, depth })
      continue
    }
    const laneKey = step.kind === 'elapse' ? 'time' : (step.actor ?? 'unknown')
    const laneTitle = step.kind === 'elapse' ? text.label('timeLapse') : (step.actorTitle ?? '')
    const pending = step.scenarioId !== null && table.scenarios.get(step.scenarioId)?.pending === true
    steps.push({ number, step, laneKey, laneTitle, pending })
  }
  return { steps, groups }
}

const boxStyle: Readonly<Record<FlowStepNode['kind'], string>> = {
  operate: 'border-primary bg-surface',
  outside: 'border-line bg-outside',
  occur: 'border-event-line bg-event',
  elapse: 'border-time-line bg-time',
  nest: 'border-line bg-surface',
}

const kindLabel: Readonly<Record<FlowStepNode['kind'], string>> = {
  operate: text.label('screenOperation'),
  outside: text.label('outsideWork'),
  occur: text.label('externalEvent'),
  elapse: text.label('timeLapse'),
  nest: text.label('childFlow'),
}

export function FlowDiagram({ flow }: { readonly flow: FlowNode }) {
  const table = useModel()
  const { steps, groups } = expandSteps(table, flow)
  const lanes = [...new Map(steps.map((step) => [step.laneKey, step.laneTitle])).entries()]
  const laneIndex = new Map(lanes.map(([laneKey], index) => [laneKey, index]))
  const groupDepth = groups.reduce((depth, group) => Math.max(depth, group.depth + 1), 0)
  const top = groupDepth * groupHeight
  const width = diagramMargin * 2 + steps.length * columnWidth
  const height = top + lanes.length * laneHeight
  const measureBoxLeft = (index: number) => diagramMargin + index * columnWidth + (columnWidth - boxWidth) / 2
  const measureBoxTop = (laneKey: string) => top + (laneIndex.get(laneKey) ?? 0) * laneHeight + (laneHeight - boxHeight) / 2

  return (
    <figure aria-label={`${flow.title}の${text.label('laneDiagram')}`} className="flex rounded-control border border-line bg-surface">
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
                  {diagramStep.number}・{kindLabel[step.kind]}
                  {diagramStep.pending ? `・${text.label('pending')}` : ''}
                  {step.extensions.length > 0 ? `・${text.label('extension')}` : ''}
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
