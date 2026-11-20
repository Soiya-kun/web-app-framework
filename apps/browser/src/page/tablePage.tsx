import { getRouteApi } from '@tanstack/react-router'
import { Badge, Cell, HeaderCell, PageTitle, Section, SourcePlace, Table, TextLink } from '../component/part'
import { useModel } from '../model'
import { useText, useLabelFormat } from '../text'

const tableRoute = getRouteApi('/table/$tableId')

export function TablePage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { tableId } = tableRoute.useParams()
  const { tables } = useModel()
  const table = tables.get(tableId)
  if (table === undefined) {
    return <PageTitle>{text.message('missingTarget')}</PageTitle>
  }

  return (
    <>
      <PageTitle level={text.label('table')}>{table.title}</PageTitle>
      <p className="font-mono text-xs">{table.id}</p>
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
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      <Section title={text.label('statement')}>
        <ul className="flex flex-wrap gap-1">
          {table.statementIds.map((statementId) => (
            <li key={statementId}>
              <Badge>
                <TextLink to="/statement/$statementId" params={{ statementId }}>
                  {statementId}
                </TextLink>
              </Badge>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
