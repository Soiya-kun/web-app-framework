import type { LegacyFlowNode } from '@app/translator/model-types'
import { getRouteApi } from '@tanstack/react-router'
import { FlowDiagram } from '../component/flowDiagram'
import { readStepKindLabels } from '../component/kindLabel'
import { ChangeBadge, ReplacementList, useChangeSummary } from '../component/legacyPart'
import { PlaceMinutes } from '../component/meetingPart'
import { Badge, Cell, HeaderCell, PageTitle, Section, SourcePlace, Table, TextLink } from '../component/part'
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
