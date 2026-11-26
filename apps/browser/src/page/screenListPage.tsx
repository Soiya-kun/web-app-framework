import { screenKindLabels, TransitionDiagram } from '../component/screenPart'
import { Cell, HeaderCell, PageTitle, Section, Table, TextLink } from '../component/part'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'

/** 画面一覧と画面遷移（IPA「機能要件の合意形成ガイド 画面編」の表記）。画面の部品と画面遷移のテストから作る。 */
export function ScreenListPage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { model, scenarios } = useModel()
  const wholeEdges = model.transitions.flatMap((transition) => transition.traces.flatMap((trace) => trace.edges))
  const wholeEntryIds = [...new Set(model.transitions.flatMap((transition) => transition.traces.flatMap((trace) => trace.startIds)))]

  return (
    <>
      <PageTitle>{text.label('screenList')}</PageTitle>
      <p className="text-sm">
        <TextLink to="/screens/rule">{text.label('commonRule')}</TextLink>
      </p>
      <Section title={labelFormat.joinNote(text.label('screenList'), String(model.screens.length))}>
        <Table caption={text.label('screenList')}>
          <thead>
            <tr>
              <HeaderCell>{text.label('number')}</HeaderCell>
              <HeaderCell>{text.label('screenName')}</HeaderCell>
              <HeaderCell>{text.label('screenId')}</HeaderCell>
              <HeaderCell>{text.label('classification')}</HeaderCell>
              <HeaderCell>{text.label('hierarchy')}</HeaderCell>
              <HeaderCell>{text.label('description')}</HeaderCell>
              <HeaderCell>{text.label('featureName')}</HeaderCell>
              <HeaderCell>{text.label('featureId')}</HeaderCell>
              <HeaderCell>{text.label('note')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {model.screens.map((screen, index) => (
              <tr key={screen.id}>
                <Cell>
                  <span className="tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                </Cell>
                <Cell>
                  <span className="whitespace-nowrap">
                    <TextLink to="/screen/$screenId" params={{ screenId: screen.id }}>
                      {screen.title}
                    </TextLink>
                  </span>
                </Cell>
                <Cell>
                  <span className="font-mono text-xs">{screen.id}</span>
                </Cell>
                <Cell>
                  <span className="whitespace-nowrap">{text.label(screenKindLabels[screen.kind])}</span>
                </Cell>
                <Cell>{screen.hierarchy.map((screenId) => model.screens.find((item) => item.id === screenId)?.title ?? screenId).join(' › ')}</Cell>
                <Cell>{screen.summary}</Cell>
                <Cell>{labelFormat.joinList(screen.scenarioIds.map((scenarioId) => scenarios.get(scenarioId)?.title ?? scenarioId))}</Cell>
                <Cell>
                  <span className="font-mono text-xs">{screen.scenarioIds.join(', ')}</span>
                </Cell>
                <Cell>
                  <span className="font-mono text-xs">{screen.path}</span>
                </Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      <Section title={labelFormat.joinNote(text.label('transition'), String(model.transitions.length))}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">{text.label('whole')}</h3>
            <TransitionDiagram label={labelFormat.joinItem(text.label('whole'), text.label('transition'))} edges={wholeEdges} entryIds={wholeEntryIds} />
          </div>
          {model.transitions.map((transition) => (
            <div key={transition.id} className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">{transition.title}</h3>
              <TransitionDiagram
                label={transition.title}
                edges={transition.traces.flatMap((trace) => trace.edges)}
                entryIds={[...new Set(transition.traces.flatMap((trace) => trace.startIds))]}
              />
              <ul className="list-disc pl-5 text-xs text-muted">
                {transition.traces.map((trace) => (
                  <li key={trace.title}>{trace.title}</li>
                ))}
              </ul>
              <p className="font-mono text-xs text-muted">{transition.file}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}
