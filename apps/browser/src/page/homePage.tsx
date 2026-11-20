import { useState } from 'react'
import { arrangeFlowAreas, sumPendingSteps } from '../component/flowArea'
import { Badge, Cell, HeaderCell, PageTitle, Section, Table, TextLink } from '../component/part'
import { useModel } from '../model'
import { useText, useLabelFormat } from '../text'

/** 業務フローの一覧・進み具合・規則の問題と、名前で探す入口。 */
export function HomePage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { model, scenarios } = useModel()
  const [query, setQuery] = useState('')
  const { progress } = model
  const trimmedQuery = query.trim()
  const results =
    trimmedQuery === ''
      ? []
      : [
          ...model.flows.map((flow) => ({
            key: `flow-${flow.id}`,
            to: '/flow/$flowId',
            params: { flowId: flow.id },
            title: flow.title,
            kind: text.label('flow'),
          })),
          ...model.scenarios.map((scenario) => ({
            key: `scenario-${scenario.id}`,
            to: '/scenario/$scenarioId',
            params: { scenarioId: scenario.id },
            title: scenario.title,
            kind: text.label('scenario'),
          })),
          ...model.works.map((work) => ({
            key: `work-${work.id}`,
            to: '/work/$workId',
            params: { workId: work.id },
            title: work.title,
            kind: text.label('work'),
          })),
          ...model.tables.map((table) => ({
            key: `table-${table.id}`,
            to: '/table/$tableId',
            params: { tableId: table.id },
            title: table.title,
            kind: text.label('table'),
          })),
        ].filter((result) => result.title.includes(trimmedQuery) || result.key.toLowerCase().includes(trimmedQuery.toLowerCase()))

  return (
    <>
      <PageTitle>{text.label('codeBrowser')}</PageTitle>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{text.label('search')}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          className="rounded-control border border-line bg-surface px-3 py-2"
          placeholder={text.message('searchPrompt')}
        />
      </label>
      {trimmedQuery === '' ? null : (
        <Section title={text.label('searchResult')}>
          <ul className="flex flex-col gap-1 text-sm">
            {results.map((result) => (
              <li key={result.key}>
                <Badge>{result.kind}</Badge>{' '}
                <TextLink to={result.to} params={result.params}>
                  {result.title}
                </TextLink>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={text.label('progress')}>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            [text.label('flow'), labelFormat.joinNote(String(progress.flows), `${text.label('step')} ${progress.flowSteps}`)],
            [text.label('scenario'), labelFormat.joinNote(String(progress.scenarios), `${text.label('pending')} ${progress.pendingScenarios}`)],
            [text.label('extension'), labelFormat.joinNote(String(progress.extensions), `${text.label('pending')} ${progress.pendingExtensions}`)],
            [text.label('case'), labelFormat.joinNote(String(progress.cases), `${text.label('pending')} ${progress.pendingCases}`)],
          ].map(([labelText, detail]) => (
            <div key={labelText} className="flex flex-col rounded-control bg-canvas px-3 py-2">
              <dt className="text-xs text-muted">{labelText}</dt>
              <dd className="font-bold tabular-nums">{detail}</dd>
            </div>
          ))}
        </dl>
      </Section>
      {model.problems.length === 0 ? null : (
        <Section title={text.label('ruleProblem')}>
          <ul className="flex flex-col gap-1 text-sm">
            {model.problems.map((problem) => (
              <li key={`${problem.file}:${problem.line}:${problem.rule}:${problem.message}`}>
                <Badge tone="pending">{problem.rule}</Badge> {problem.message}（
                <span className="font-mono text-xs">
                  {problem.file}:{problem.line}
                </span>
                ）
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={text.label('flow')}>
        <div className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          {arrangeFlowAreas(model.flows).map((area) => (
            <div key={area.id} className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-muted">{area.title}</h3>
              <ul className="flex flex-col gap-1.5">
                {area.flows.map((flow) => {
                  const pendingCount = sumPendingSteps(flow, scenarios)
                  return (
                    <li key={flow.id}>
                      {flow.parentIds.length > 0 ? (
                        <Badge>{text.label('childFlow')}</Badge>
                      ) : (
                        <Badge tone="primary">{text.label('summary')}</Badge>
                      )}{' '}
                      <TextLink to="/flow/$flowId" params={{ flowId: flow.id }}>
                        {flow.title}
                      </TextLink>
                      {pendingCount === 0 ? null : (
                        <>
                          {' '}
                          <Badge tone="pending">
                            {text.label('pending')} {pendingCount}
                          </Badge>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </Section>
      <Section title={text.label('scenario')}>
        <Table caption={text.label('scenario')}>
          <thead>
            <tr>
              <HeaderCell>{text.label('scenario')}</HeaderCell>
              <HeaderCell>{text.label('actor')}</HeaderCell>
              <HeaderCell>{text.label('flow')}</HeaderCell>
              <HeaderCell>{text.label('caseCount')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {[...scenarios.values()].map((scenario) => (
              <tr key={scenario.id}>
                <Cell>
                  <TextLink to="/scenario/$scenarioId" params={{ scenarioId: scenario.id }}>
                    {scenario.title}
                  </TextLink>{' '}
                  {scenario.pending ? <Badge tone="pending">{text.label('pending')}</Badge> : null}
                </Cell>
                <Cell>{scenario.actorTitle}</Cell>
                <Cell>
                  {labelFormat.joinList([...new Set(scenario.usedIn.map((use) => model.flows.find((flow) => flow.id === use.flowId)?.title ?? use.flowId))])}
                </Cell>
                <Cell>{scenario.cases.length}</Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      <div className="grid gap-5 md:grid-cols-2">
        <Section title={text.label('work')}>
          <ul className="flex flex-col gap-1 text-sm">
            {model.works.map((work) => (
              <li key={work.id}>
                <TextLink to="/work/$workId" params={{ workId: work.id }}>
                  {work.title}
                </TextLink>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={text.label('table')}>
          <ul className="flex flex-col gap-1 text-sm">
            {model.tables.map((table) => (
              <li key={table.id}>
                <TextLink to="/table/$tableId" params={{ tableId: table.id }}>
                  {table.title}
                </TextLink>{' '}
                <span className="font-mono text-xs text-muted">{table.id}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  )
}
