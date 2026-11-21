import { useChangeSummary } from '../component/legacyPart'
import { Cell, HeaderCell, PageTitle, Section, Table, TextLink } from '../component/part'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'

/** 現行の業務フロー（領域ごと。置き換え先と変わり方の数）と、旧システムのテーブルの一覧。 */
export function LegacyListPage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const formatChangeSummary = useChangeSummary()
  const { model, flows } = useModel()
  const areas = [...new Map(model.legacyFlows.map((legacy) => [legacy.area, legacy.areaTitle])).entries()]

  return (
    <>
      <PageTitle>{text.label('legacy')}</PageTitle>
      <Section title={labelFormat.joinNote(text.label('legacyFlow'), String(model.legacyFlows.length))}>
        <div className="flex flex-col gap-4">
          {areas.map(([area, areaTitle]) => (
            <div key={area} className="flex flex-col gap-1">
              <h3 className="text-xs font-bold text-muted">{areaTitle}</h3>
              <ul className="flex flex-col gap-2 text-sm">
                {model.legacyFlows
                  .filter((legacy) => legacy.area === area)
                  .map((legacy) => (
                    <li key={legacy.id} className="flex flex-col gap-0.5">
                      <span>
                        <TextLink to="/legacy/$legacyId" params={{ legacyId: legacy.id }}>
                          {legacy.title}
                        </TextLink>
                        {' → '}
                        {legacy.replacementIds.length === 0
                          ? text.label('discontinuation')
                          : labelFormat.joinList(legacy.replacementIds.map((flowId) => flows.get(flowId)?.title ?? flowId))}
                      </span>
                      <span className="text-xs text-muted">{formatChangeSummary(legacy)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
      <Section title={labelFormat.joinNote(text.label('legacyTable'), String(model.legacyTables.length))}>
        <Table caption={text.label('legacyTable')}>
          <thead>
            <tr>
              <HeaderCell>{text.label('table')}</HeaderCell>
              <HeaderCell>{text.label('name')}</HeaderCell>
              <HeaderCell>{text.label('column')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {model.legacyTables.map((table) => (
              <tr key={table.id}>
                <Cell>
                  <TextLink to="/legacy/table/$tableId" params={{ tableId: table.id }}>
                    {table.title}
                  </TextLink>
                </Cell>
                <Cell>
                  <span className="font-mono text-xs">{table.name}</span>
                </Cell>
                <Cell>{table.columns.length}</Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </>
  )
}
