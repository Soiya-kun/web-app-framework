import { getRouteApi } from '@tanstack/react-router'
import { PlaceMinutes } from '../component/meetingPart'
import { Cell, HeaderCell, PageTitle, Section, SourcePlace, Table, TextLink } from '../component/part'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'
import { PlaceEstimate } from '../component/estimatePart'

const legacyTableRoute = getRouteApi('/legacy/table/$tableId')

/** 旧システムのテーブル。列の意味と、移す先の新しいテーブルの列。使っている現行の業務フローの段。 */
export function LegacyTablePage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { tableId } = legacyTableRoute.useParams()
  const { model, legacyTables } = useModel()
  const table = legacyTables.get(tableId)
  if (table === undefined) {
    return <PageTitle>{text.message('missingTarget')}</PageTitle>
  }
  const usingSteps = model.legacyFlows.flatMap((legacy) => legacy.steps.filter((step) => step.tableIds.includes(table.id)).map((step) => ({ legacy, step })))

  return (
    <>
      <PageTitle level={text.label('legacyTable')}>{table.title}</PageTitle>
      <p className="font-mono text-xs">{table.name}</p>
      <p className="text-sm">{table.note}</p>
      <SourcePlace file={table.file} line={table.line} />
      <Section title={text.label('column')}>
        <Table caption={labelFormat.joinItem(table.title, text.label('column'))}>
          <thead>
            <tr>
              <HeaderCell>{text.label('column')}</HeaderCell>
              <HeaderCell>{text.label('name')}</HeaderCell>
              <HeaderCell>{text.label('type')}</HeaderCell>
              <HeaderCell>{text.label('note')}</HeaderCell>
              <HeaderCell>{text.label('replacement')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((column) => (
              <tr key={column.name}>
                <Cell>{column.title}</Cell>
                <Cell>
                  <span className="font-mono text-xs">{column.name}</span>
                </Cell>
                <Cell>{column.type}</Cell>
                <Cell>{column.note}</Cell>
                <Cell>
                  {column.replacement === null ? null : (
                    <TextLink to="/table/$tableId" params={{ tableId: column.replacement.tableId }}>
                      <span className="font-mono text-xs">{`${column.replacement.tableId}.${column.replacement.column}`}</span>
                    </TextLink>
                  )}
                </Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      <Section title={text.label('legacyFlow')}>
        <ul className="flex flex-col gap-1 text-sm">
          {usingSteps.map(({ legacy, step }) => (
            <li key={`${legacy.id}-${step.number}`}>
              <TextLink to="/legacy/$legacyId" params={{ legacyId: legacy.id }}>
                {legacy.title}
              </TextLink>
              {labelFormat.formatStepNumber(step.number)}
              {labelFormat.mark}
              {step.title}
            </li>
          ))}
        </ul>
      </Section>
      <PlaceEstimate matchPlace={(place) => place.kind === 'legacyTable' && place.id === table.id} />
      <PlaceMinutes matchPlace={(place) => place.kind === 'legacyTable' && place.id === table.id} />
    </>
  )
}
