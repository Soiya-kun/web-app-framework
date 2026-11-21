import type { EstimateNode } from '@app/translator/model-types'
import { getRouteApi } from '@tanstack/react-router'
import { useDayFormat, useEffortFormat, useYenFormat } from '../component/estimatePart'
import { PlaceLink, PlaceList } from '../component/meetingPart'
import { Cell, HeaderCell, PageTitle, Section, SourcePlace, Table } from '../component/part'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'

const estimateRoute = getRouteApi('/estimate/$estimateId')

/**
 * 1つの版の見積。項目の名前・対象・金額と合計、前の版との差。
 * いちばん新しい版には、項目に割り当てた機能ごとの工数（人手・監査）と、人日単価をかけた金額も出す。
 */
export function EstimatePage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const formatYen = useYenFormat()
  const formatDay = useDayFormat()
  const { estimateId } = estimateRoute.useParams()
  const { model, estimates } = useModel()
  const estimate = estimates.get(estimateId)
  if (estimate === undefined) {
    return <PageTitle>{text.message('missingTarget')}</PageTitle>
  }
  const previous = model.estimates[model.estimates.indexOf(estimate) - 1]
  const hasEffort = estimate.items.some((item) => item.manual !== null) && model.efforts.length > 0
  const rate = estimate.rate
  const readDayCell = (days: number | null) => (days === null || days === 0 ? '' : formatDay(days))
  const readYenCell = (days: number | null) => (rate === null || days === null || days === 0 ? '' : formatYen(days * rate))
  const sumOf = (key: 'manual' | 'audit') => estimate.items.reduce((sum, item) => sum + (item[key] ?? 0), 0)

  return (
    <>
      <PageTitle level={labelFormat.joinNote(text.label('estimate'), estimate.date)}>{estimate.title}</PageTitle>
      <SourcePlace file={estimate.file} line={estimate.line} />
      {rate === null ? null : <p className="text-sm">{labelFormat.joinNote(text.label('effortRate'), formatYen(rate))}</p>}
      <Section title={labelFormat.joinNote(text.label('estimateItem'), String(estimate.items.length))}>
        <Table caption={labelFormat.joinItem(estimate.title, text.label('estimateItem'))}>
          <thead>
            <tr>
              <HeaderCell>{text.label('estimateItem')}</HeaderCell>
              <HeaderCell>{text.label('target')}</HeaderCell>
              <HeaderCell>{text.label('amount')}</HeaderCell>
              {hasEffort ? (
                <>
                  <HeaderCell>{text.label('manualEffort')}</HeaderCell>
                  {rate === null ? null : <HeaderCell>{text.label('manualAmount')}</HeaderCell>}
                  <HeaderCell>{text.label('auditEffort')}</HeaderCell>
                  {rate === null ? null : <HeaderCell>{text.label('auditAmount')}</HeaderCell>}
                </>
              ) : null}
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
                {hasEffort ? (
                  <>
                    <Cell>{readDayCell(item.manual)}</Cell>
                    {rate === null ? null : <Cell>{readYenCell(item.manual)}</Cell>}
                    <Cell>{readDayCell(item.audit)}</Cell>
                    {rate === null ? null : <Cell>{readYenCell(item.audit)}</Cell>}
                  </>
                ) : null}
              </tr>
            ))}
            <tr>
              <Cell>{text.label('sum')}</Cell>
              <Cell>{previous === undefined ? null : labelFormat.joinNote(previous.title, formatYen(estimate.totalAmount - previous.totalAmount))}</Cell>
              <Cell>
                <span className="font-bold tabular-nums">{formatYen(estimate.totalAmount)}</span>
              </Cell>
              {hasEffort ? (
                <>
                  <Cell>{readDayCell(sumOf('manual'))}</Cell>
                  {rate === null ? null : <Cell>{readYenCell(sumOf('manual'))}</Cell>}
                  <Cell>{readDayCell(sumOf('audit'))}</Cell>
                  {rate === null ? null : <Cell>{readYenCell(sumOf('audit'))}</Cell>}
                </>
              ) : null}
            </tr>
          </tbody>
        </Table>
      </Section>
      {hasEffort ? <EffortSummary estimate={estimate} /> : null}
    </>
  )
}

/** 機能ごとの工数の合計と、人日単価をかけた金額（要件が固まった新しいシステムの金額）。見積のどの項目にも当たらない工数。 */
function EffortSummary({ estimate }: { readonly estimate: EstimateNode }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const formatYen = useYenFormat()
  const formatDay = useDayFormat()
  const formatEffort = useEffortFormat()
  const { model } = useModel()
  const manual = model.efforts.reduce((sum, effort) => sum + effort.manual, 0)
  const audit = model.efforts.reduce((sum, effort) => sum + effort.audit, 0)
  const rate = estimate.rate
  const unestimatedEfforts = model.efforts.filter((effort) => effort.itemIndex === null)
  return (
    <Section title={text.label('effort')}>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {(
          [
            ['manualEffort', manual],
            ['auditEffort', audit],
          ] as const
        ).map(([key, days]) => (
          <div key={key} className="flex flex-col gap-0.5">
            <dt className="text-xs font-bold text-muted">{text.label(key)}</dt>
            <dd className="tabular-nums">
              {formatDay(days)}
              {rate === null ? null : (
                <>
                  {labelFormat.mark}
                  <span className="font-bold">{formatYen(days * rate)}</span>
                  {key === 'manualEffort' ? <span className="text-muted">{labelFormat.formatNote(`${text.label('estimate')} ${formatYen(days * rate - estimate.totalAmount)}`)}</span> : null}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {unestimatedEfforts.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-bold text-muted">{labelFormat.joinNote(text.label('unestimatedEffort'), String(unestimatedEfforts.length))}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {unestimatedEfforts.map((effort) => (
              <li key={`${effort.target.kind}-${effort.target.id}-${effort.target.extension ?? ''}`}>
                <PlaceLink place={effort.target} />
                {labelFormat.mark}
                {formatEffort(effort)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}
