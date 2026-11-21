import type { LegacyFlowNode } from '@app/translator/model-types'
import { getRouteApi } from '@tanstack/react-router'
import { FlowDiagram } from '../component/flowDiagram'
import { readStepKindLabels } from '../component/kindLabel'
import { ChangeBadge, ReplacementList, useChangeSummary } from '../component/legacyPart'
import { PlaceMinutes } from '../component/meetingPart'
import { Badge, Cell, HeaderCell, PageTitle, Section, SourcePlace, StepList, Table, TextLink } from '../component/part'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'

const legacyRoute = getRouteApi('/legacy/$legacyId')

/** 現行の業務フロー。レーン図と、置き換え先の新しい業務フローとの比べ（段ごとの変わり方と、新しい段）。 */
export function LegacyPage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const kindLabel = readStepKindLabels(text)
  const formatChangeSummary = useChangeSummary()
  const { legacyId } = legacyRoute.useParams()
  const { legacyFlows, legacyTables, flows } = useModel()
  const legacy = legacyFlows.get(legacyId)
  if (legacy === undefined) {
    return <PageTitle>{text.message('missingTarget')}</PageTitle>
  }

  return (
    <>
      <PageTitle level={text.label('legacyFlow')}>{legacy.title}</PageTitle>
      <SourcePlace file={legacy.file} line={legacy.line} />
      <p className="text-sm">
        {text.label('replacement')}:{' '}
        {legacy.replacementIds.length === 0 ? (
          <Badge tone="pending">{text.label('discontinuation')}</Badge>
        ) : (
          legacy.replacementIds.map((flowId, index) => (
            <span key={flowId}>
              {index === 0 ? null : labelFormat.mark}
              <TextLink to="/flow/$flowId" params={{ flowId }}>
                {flows.get(flowId)?.title ?? flowId}
              </TextLink>
            </span>
          ))
        )}
        {labelFormat.mark}
        <span className="text-muted">{formatChangeSummary(legacy)}</span>
      </p>
      <Section title={text.label('laneDiagram')}>
        <FlowDiagram flow={legacy} legacy />
      </Section>
      <Section title={text.label('comparison')}>
        <Table caption={labelFormat.joinItem(legacy.title, text.label('comparison'))}>
          <thead>
            <tr>
              <HeaderCell>{text.label('step')}</HeaderCell>
              <HeaderCell>{text.label('legacyFlow')}</HeaderCell>
              <HeaderCell>{text.label('stepChange')}</HeaderCell>
              <HeaderCell>{text.label('replacement')}</HeaderCell>
              <HeaderCell>{text.label('legacyTable')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {legacy.steps.map((step) => (
              <tr key={step.number}>
                <Cell>{step.number}</Cell>
                <Cell>
                  {step.title}
                  <span className="block text-xs text-muted">{labelFormat.joinList([kindLabel[step.kind], ...(step.actorTitle === null ? [] : [step.actorTitle])])}</span>
                </Cell>
                <Cell>{step.change === null ? null : <ChangeBadge change={step.change} />}</Cell>
                <Cell>
                  <ReplacementList list={step.replacements} />
                </Cell>
                <Cell>
                  {step.tableIds.map((tableId, index) => (
                    <span key={tableId}>
                      {index === 0 ? null : labelFormat.mark}
                      <TextLink to="/legacy/table/$tableId" params={{ tableId }}>
                        {legacyTables.get(tableId)?.title ?? tableId}
                      </TextLink>
                    </span>
                  ))}
                </Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      <ScreenComparison legacy={legacy} />
      <NewStepList legacy={legacy} />
      <PlaceMinutes matchPlace={(place) => place.kind === 'legacy' && place.id === legacy.id} />
    </>
  )
}

/** 新しい業務フローにあって、現行のどの段からも指されていない段。 */
function NewStepList({ legacy }: { readonly legacy: LegacyFlowNode }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  return (
    <Section title={labelFormat.joinNote(text.label('newStep'), String(legacy.addedSteps.length))}>
      <ul className="flex flex-col gap-1 text-sm">
        {legacy.addedSteps.map((step) => (
          <li key={step.number}>
            <span className="mr-2 text-xs text-muted">{step.number}</span>
            {step.scenarioId === null ? (
              step.title
            ) : (
              <TextLink to="/scenario/$scenarioId" params={{ scenarioId: step.scenarioId }}>
                {step.title}
              </TextLink>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** 画面の手順を残した旧システムの操作と、置き換え先のシナリオの手順を並べる。 */
function ScreenComparison({ legacy }: { readonly legacy: LegacyFlowNode }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { scenarios } = useModel()
  const operationSteps = legacy.steps.filter((step) => step.screenSteps.length > 0)
  if (operationSteps.length === 0) {
    return null
  }
  return (
    <Section title={labelFormat.joinItem(text.label('screen'), text.label('comparison'))}>
      <div className="flex flex-col gap-5">
        {operationSteps.map((step) => (
          <div key={step.number} className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold">
                {step.number}. {step.title}
                <span className="ml-2 text-xs font-normal text-muted">{text.label('legacyOperation')}</span>
              </h3>
              <StepList label={labelFormat.joinItem(step.title, text.label('step'))} steps={step.screenSteps} />
              {step.guarantee.length === 0 ? null : <p className="text-xs text-muted">{labelFormat.joinNote(text.label('successGuarantee'), step.guarantee.join(labelFormat.mark))}</p>}
            </div>
            <div className="flex flex-col gap-3">
              {step.replacements.flatMap((replacement) => {
                const scenario = replacement.kind === 'scenario' ? scenarios.get(replacement.id) : undefined
                return scenario === undefined
                  ? []
                  : [
                      <div key={scenario.id} className="flex flex-col gap-1">
                        <h3 className="text-sm font-bold">
                          <TextLink to="/scenario/$scenarioId" params={{ scenarioId: scenario.id }}>
                            {scenario.title}
                          </TextLink>
                          <span className="ml-2 text-xs font-normal text-muted">{text.label('replacement')}</span>
                        </h3>
                        {scenario.pending ? (
                          <Badge tone="pending">{text.label('pending')}</Badge>
                        ) : (
                          <StepList label={labelFormat.joinItem(scenario.title, text.label('step'))} steps={scenario.steps} />
                        )}
                      </div>,
                    ]
              })}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
