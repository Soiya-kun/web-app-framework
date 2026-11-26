import { getRouteApi } from '@tanstack/react-router'
import { dataTypeLabels, partKindLabels, ScreenLayout, ScreenLink, TransitionDiagram } from '../component/screenPart'
import { Cell, HeaderCell, PageTitle, Section, SourcePlace, StepList, Table, TextLink } from '../component/part'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'

const screenRoute = getRouteApi('/screen/$screenId')

/** 1つの画面の設計書。書誌情報・画面レイアウト・画面入出力項目一覧・画面アクション明細・関連する機能・画面遷移（IPA 画面編の表記）。 */
export function ScreenPage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { screenId } = screenRoute.useParams()
  const { model, scenarios } = useModel()
  const screen = model.screens.find((item) => item.id === screenId)
  if (screen === undefined) {
    return <PageTitle>{text.message('missingTarget')}</PageTitle>
  }
  const edges = model.transitions.flatMap((transition) => transition.traces.flatMap((trace) => trace.edges)).filter((edge) => edge.from === screen.id || edge.to === screen.id)
  const entryIds = [...new Set(model.transitions.flatMap((transition) => transition.traces.flatMap((trace) => trace.startIds)))].filter((entryId) => edges.some((edge) => edge.from === entryId || edge.to === entryId))
  const mark = (value: boolean) => (value ? '○' : '×')

  return (
    <>
      <PageTitle level={labelFormat.joinNote(text.label('screen'), screen.id)}>{screen.title}</PageTitle>
      <SourcePlace file={screen.file} line={screen.line} />
      <Section title={text.label('bibliography')}>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-xs font-bold text-muted">{text.label('screenId')}</dt>
          <dd className="font-mono text-xs">{screen.id}</dd>
          <dt className="text-xs font-bold text-muted">{text.label('screenName')}</dt>
          <dd>{screen.title}</dd>
          <dt className="text-xs font-bold text-muted">{text.label('summary')}</dt>
          <dd>{screen.summary}</dd>
        </dl>
      </Section>
      <Section title={text.label('screenLayout')}>
        <ScreenLayout screen={screen} />
      </Section>
      <Section title={labelFormat.joinNote(text.label('screenItem'), String(screen.items.length))}>
        <Table caption={labelFormat.joinItem(screen.title, text.label('screenItem'))}>
          <thead>
            <tr>
              <HeaderCell>{text.label('partNumber')}</HeaderCell>
              <HeaderCell>{text.label('displayLabel')}</HeaderCell>
              <HeaderCell>{text.label('partKind')}</HeaderCell>
              <HeaderCell>{text.label('input')}</HeaderCell>
              <HeaderCell>{text.label('dataType')}</HeaderCell>
              <HeaderCell>{text.label('inputConstraint')}</HeaderCell>
              <HeaderCell>{text.label('initialDisplay')}</HeaderCell>
              <HeaderCell>{text.label('outputSpecification')}</HeaderCell>
              <HeaderCell>{text.label('supplement')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {screen.items.map((item) => (
              <tr key={item.number}>
                <Cell>{item.number}</Cell>
                <Cell>{item.label}</Cell>
                <Cell>
                  <span className="whitespace-nowrap">{text.label(partKindLabels[item.kind])}</span>
                </Cell>
                <Cell>{mark(item.input)}</Cell>
                <Cell>
                  <span className="whitespace-nowrap">{item.dataType === null ? '' : text.label(dataTypeLabels[item.dataType])}</span>
                </Cell>
                <Cell>{labelFormat.joinList(item.constraints)}</Cell>
                <Cell>{item.initial ?? ''}</Cell>
                <Cell>{item.output === 'right' ? text.label('rightAlignment') : ''}</Cell>
                <Cell>
                  <span className="whitespace-nowrap">{item.note}</span>
                </Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      <Section title={labelFormat.joinNote(text.label('screenAction'), String(screen.actions.length))}>
        <Table caption={labelFormat.joinItem(screen.title, text.label('screenAction'))}>
          <thead>
            <tr>
              <HeaderCell>{text.label('id')}</HeaderCell>
              <HeaderCell>{text.label('actionName')}</HeaderCell>
              <HeaderCell>{text.label('eventName')}</HeaderCell>
              <HeaderCell>{text.label('actionSummary')}</HeaderCell>
              <HeaderCell>{text.label('input')}</HeaderCell>
              <HeaderCell>{text.label('actionDetail')}</HeaderCell>
              <HeaderCell>{text.label('destinationScreen')}</HeaderCell>
              <HeaderCell>{text.label('output')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {screen.actions.map((action) => (
              <tr key={action.number}>
                <Cell>{action.number}</Cell>
                <Cell>
                  <span className="whitespace-nowrap">{action.name}</span>
                </Cell>
                <Cell>
                  <span className="whitespace-nowrap">{action.event}</span>
                </Cell>
                <Cell>{labelFormat.joinList(action.summary)}</Cell>
                <Cell>
                  <ActionData items={action.inputs} tables={action.inputTables} />
                </Cell>
                <Cell>{action.steps.length === 0 ? null : <StepList label={labelFormat.joinItem(action.name, text.label('actionDetail'))} steps={action.steps} />}</Cell>
                <Cell>
                  {action.destinationIds.map((destinationId) => (
                    <span key={destinationId} className="block">
                      <ScreenLink screenId={destinationId} />
                    </span>
                  ))}
                </Cell>
                <Cell>
                  <ActionData items={[]} tables={action.outputTables} />
                </Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      <Section title={labelFormat.joinNote(text.label('feature'), String(screen.scenarioIds.length))}>
        <ul className="flex flex-col gap-1 text-sm">
          {screen.scenarioIds.map((scenarioId) => (
            <li key={scenarioId}>
              <TextLink to="/scenario/$scenarioId" params={{ scenarioId }}>
                {scenarios.get(scenarioId)?.title ?? scenarioId}
              </TextLink>
            </li>
          ))}
        </ul>
      </Section>
      {edges.length === 0 ? null : (
        <Section title={text.label('transition')}>
          <TransitionDiagram label={labelFormat.joinItem(screen.title, text.label('transition'))} edges={edges} entryIds={entryIds} />
        </Section>
      )}
    </>
  )
}

/** アクションの入力・出力。画面の入力欄を1行ずつ並べ、処理が読む・書くテーブルを「テーブル」の見出しのあとに並べる。 */
function ActionData({ items, tables }: { readonly items: readonly string[]; readonly tables: readonly string[] }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={item} className="whitespace-nowrap">
          {item}
        </li>
      ))}
      {tables.length === 0 ? null : (
        <li className="text-muted">{labelFormat.joinNote(text.label('table'), labelFormat.joinList(tables))}</li>
      )}
    </ul>
  )
}
