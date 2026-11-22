import type { FlowNode, FlowStepNode } from '@app/translator/model-types'
import { getRouteApi } from '@tanstack/react-router'
import { FlowDiagram } from '../component/flowDiagram'
import { Badge, Cell, HeaderCell, PageTitle, Section, SourcePlace, Table, TextLink } from '../component/part'
import { useModel, type ModelTable } from '../model'
import { readStepKindLabels } from '../component/kindLabel'
import { useText, useLabelFormat } from '../text'
import { useChangeSummary } from '../component/legacyPart'
import { PlaceMinutes, prepareFlowMatch } from '../component/meetingPart'
import { PlaceEstimate } from '../component/estimatePart'
import { MockLink } from '../component/mockLink'

const flowRoute = getRouteApi('/flow/$flowId')

/** 段の見出し。シナリオなら、シナリオのページへのリンク。 */
function StepTitle({ step }: { readonly step: FlowStepNode }) {
  if (step.scenarioId !== null) {
    return (
      <TextLink to="/scenario/$scenarioId" params={{ scenarioId: step.scenarioId }}>
        {step.title}
      </TextLink>
    )
  }
  if (step.flowId !== null) {
    return (
      <TextLink to="/flow/$flowId" params={{ flowId: step.flowId }}>
        {step.title}
      </TextLink>
    )
  }
  return <>{step.title}</>
}

/** テストで流す経路（本線と、子フローを含む拡張ごと）。 */
function listCourses(table: ModelTable, flow: FlowNode, prefix = '', depth = 0): { key: string; condition: string }[] {
  return flow.steps.flatMap((step) => {
    const child = step.flowId === null ? undefined : table.flows.get(step.flowId)
    const nested = child === undefined || depth > 3 ? [] : listCourses(table, child, `${prefix}${step.number}.`, depth + 1)
    return [...step.extensions.map((extension) => ({ key: `${prefix}${extension.key}`, condition: extension.condition })), ...nested]
  })
}

export function FlowPage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const kindLabel = readStepKindLabels(text)
  const { flowId } = flowRoute.useParams()
  const table = useModel()
  const flow = table.flows.get(flowId)
  if (flow === undefined) {
    return <PageTitle>{text.message('missingTarget')}</PageTitle>
  }
  const courses = listCourses(table, flow)
  const extensionSteps = flow.steps.filter((step) => step.extensions.length > 0)

  return (
    <>
      <PageTitle level={labelFormat.joinNote(text.label('summary'), text.label('flow'))}>{flow.title}</PageTitle>
      <SourcePlace file={flow.file} line={flow.line} />
      {flow.precondition === null ? null : (
        <Section title={text.label('precondition')}>
          <p className="text-sm">{flow.precondition}</p>
        </Section>
      )}
      {flow.parentIds.length === 0 ? null : (
        <Section title={text.label('parentFlow')}>
          <ul className="text-sm">
            {flow.parentIds.map((parentId) => (
              <li key={parentId}>
                <TextLink to="/flow/$flowId" params={{ flowId: parentId }}>
                  {table.flows.get(parentId)?.title ?? parentId}
                </TextLink>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <FlowDiagram flow={flow} />
      <Section title={text.label('step')}>
        <Table caption={labelFormat.joinItem(flow.title, text.label('step'))}>
          <thead>
            <tr>
              <HeaderCell>{text.label('number')}</HeaderCell>
              <HeaderCell>{text.label('actor')}</HeaderCell>
              <HeaderCell>{text.label('step')}</HeaderCell>
              <HeaderCell>{text.label('kind')}</HeaderCell>
              <HeaderCell>{text.label('input')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {flow.steps.map((step) => (
              <tr key={step.number}>
                <Cell>{step.number}</Cell>
                <Cell>{step.actorTitle ?? '—'}</Cell>
                <Cell>
                  <StepTitle step={step} />{' '}
                  {step.scenarioId !== null && table.scenarios.get(step.scenarioId)?.pending === true ? (
                    <Badge tone="pending">{text.label('pending')}</Badge>
                  ) : null}
                  {step.kind === 'operate' && step.scenarioId !== null ? (
                    <div>
                      <MockLink flowId={flow.id} number={step.number} />
                    </div>
                  ) : null}
                </Cell>
                <Cell>{kindLabel[step.kind]}</Cell>
                <Cell>
                  {step.inputs.map((input) => (
                    <div key={input.label} className="text-xs">
                      <span className="text-muted">{input.label}</span> {input.value}
                    </div>
                  ))}
                </Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      {extensionSteps.length === 0 ? null : (
        <Section title={text.label('extension')}>
          <ul className="flex flex-col gap-3 text-sm">
            {extensionSteps.flatMap((step) =>
              step.extensions.map((extension) => (
                <li key={extension.key} className="flex flex-col gap-1">
                  <span className="font-medium">
                    {extension.key}. {extension.condition}
                  </span>
                  <MockLink flowId={flow.id} number={extension.key} />
                  <ol className="flex list-decimal flex-col gap-0.5 pl-6">
                    <li>
                      {labelFormat.joinNote(step.title, labelFormat.joinSequence(extension.inputs.map((input) => `${input.label} ${input.value}`)))}
                    </li>
                    {extension.then.map((followingStep) => (
                      <li key={followingStep.number}>
                        <StepTitle step={followingStep} />
                      </li>
                    ))}
                  </ol>
                  <span className="text-xs text-muted">
                    {extension.resume ? text.message('returnMainline') : text.message('endCourse')}
                  </span>
                </li>
              )),
            )}
          </ul>
        </Section>
      )}
      <Section title={text.label('testCourse')}>
        <ul className="flex flex-col gap-1 text-sm">
          <li>{text.label('mainline')}</li>
          {courses.map((course) => (
            <li key={course.key}>
              {course.key}. {course.condition}
            </li>
          ))}
        </ul>
      </Section>
      <LegacySection flow={flow} />
      <PlaceEstimate matchPlace={prepareFlowMatch(flow)} />
      <PlaceMinutes matchPlace={prepareFlowMatch(flow)} />
    </>
  )
}

/** この業務フローに置き換わる現行の業務フロー（比べたページへのリンクと、変わり方の数）。 */
function LegacySection({ flow }: { readonly flow: FlowNode }) {
  const text = useText()
  const formatChangeSummary = useChangeSummary()
  const { legacyFlows } = useModel()
  if (flow.legacyIds.length === 0) {
    return null
  }
  return (
    <Section title={text.label('legacyFlow')}>
      <ul className="flex flex-col gap-1 text-sm">
        {flow.legacyIds.flatMap((legacyId) => {
          const legacy = legacyFlows.get(legacyId)
          return legacy === undefined
            ? []
            : [
                <li key={legacyId} className="flex flex-col gap-0.5">
                  <TextLink to="/legacy/$legacyId" params={{ legacyId }}>
                    {legacy.title}
                  </TextLink>
                  <span className="text-xs text-muted">{formatChangeSummary(legacy)}</span>
                </li>,
              ]
        })}
      </ul>
    </Section>
  )
}
