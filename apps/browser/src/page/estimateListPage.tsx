import { useYenFormat } from '../component/estimatePart'
import { Cell, HeaderCell, PageTitle, Section, Table, TextLink } from '../component/part'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'

/** 見積の版の一覧と、いちばん新しい見積のどの項目からも指されていないシナリオ。 */
export function EstimateListPage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const formatYen = useYenFormat()
  const { model, scenarios } = useModel()

  return (
    <>
      <PageTitle>{text.label('estimate')}</PageTitle>
      <Section title={labelFormat.joinNote(text.label('estimate'), String(model.estimates.length))}>
        <Table caption={text.label('estimate')}>
          <thead>
            <tr>
              <HeaderCell>{text.label('date')}</HeaderCell>
              <HeaderCell>{text.label('title')}</HeaderCell>
              <HeaderCell>{text.label('estimateItem')}</HeaderCell>
              <HeaderCell>{text.label('sum')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {[...model.estimates].reverse().map((estimate) => (
              <tr key={estimate.id}>
                <Cell>{estimate.date}</Cell>
                <Cell>
                  <TextLink to="/estimate/$estimateId" params={{ estimateId: estimate.id }}>
                    {estimate.title}
                  </TextLink>
                </Cell>
                <Cell>{estimate.items.length}</Cell>
                <Cell>
                  <span className="tabular-nums">{formatYen(estimate.totalAmount)}</span>
                </Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      {model.estimates.length === 0 ? null : (
        <Section title={labelFormat.joinNote(text.label('unestimatedScenario'), String(model.unestimatedScenarioIds.length))}>
          <ul className="flex flex-col gap-1 text-sm">
            {model.unestimatedScenarioIds.map((scenarioId) => (
              <li key={scenarioId}>
                <TextLink to="/scenario/$scenarioId" params={{ scenarioId }}>
                  {scenarios.get(scenarioId)?.title ?? scenarioId}
                </TextLink>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
