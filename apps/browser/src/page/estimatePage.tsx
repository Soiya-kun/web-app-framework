import { getRouteApi } from '@tanstack/react-router'
import { useYenFormat } from '../component/estimatePart'
import { PlaceList } from '../component/meetingPart'
import { Cell, HeaderCell, PageTitle, Section, SourcePlace, Table } from '../component/part'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'

const estimateRoute = getRouteApi('/estimate/$estimateId')

/** 1つの版の見積。項目の名前・対象・金額と合計。前の版との差。 */
export function EstimatePage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const formatYen = useYenFormat()
  const { estimateId } = estimateRoute.useParams()
  const { model, estimates } = useModel()
  const estimate = estimates.get(estimateId)
  if (estimate === undefined) {
    return <PageTitle>{text.message('missingTarget')}</PageTitle>
  }
  const previous = model.estimates[model.estimates.indexOf(estimate) - 1]

  return (
    <>
      <PageTitle level={labelFormat.joinNote(text.label('estimate'), estimate.date)}>{estimate.title}</PageTitle>
      <SourcePlace file={estimate.file} line={estimate.line} />
      <Section title={labelFormat.joinNote(text.label('estimateItem'), String(estimate.items.length))}>
        <Table caption={labelFormat.joinItem(estimate.title, text.label('estimateItem'))}>
          <thead>
            <tr>
              <HeaderCell>{text.label('estimateItem')}</HeaderCell>
              <HeaderCell>{text.label('target')}</HeaderCell>
              <HeaderCell>{text.label('amount')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {estimate.items.map((item) => (
              <tr key={item.title}>
                <Cell>{item.title}</Cell>
                <Cell>
                  <PlaceList places={item.targets} />
                </Cell>
                <Cell>
                  <span className="tabular-nums">{formatYen(item.amount)}</span>
                </Cell>
              </tr>
            ))}
            <tr>
              <Cell>{text.label('sum')}</Cell>
              <Cell>{previous === undefined ? null : labelFormat.joinNote(previous.title, formatYen(estimate.totalAmount - previous.totalAmount))}</Cell>
              <Cell>
                <span className="font-bold tabular-nums">{formatYen(estimate.totalAmount)}</span>
              </Cell>
            </tr>
          </tbody>
        </Table>
      </Section>
    </>
  )
}
