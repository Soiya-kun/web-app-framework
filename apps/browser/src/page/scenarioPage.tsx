import type { CaseNode } from '@app/translator/model-types'
import { getRouteApi } from '@tanstack/react-router'
import { Badge, Cell, HeaderCell, PageTitle, Section, SourcePlace, StepList, Table, TextLink } from '../component/part'
import { useModel } from '../model'
import { text } from '../text'

const scenarioRoute = getRouteApi('/scenario/$scenarioId')

const caseKindLabel: Readonly<Record<CaseNode['kind'], string>> = {
  main: text.label('primarySuccessScenario'),
  vary: text.label('variation'),
  extend: text.label('extension'),
}

function CaseItem({ caseNode, condition }: { readonly caseNode: CaseNode; readonly condition: string | undefined }) {
  const columns = [...new Set(caseNode.rows.flatMap((row) => Object.keys(row)))]
  return (
    <li className="flex flex-col gap-2 rounded-control border border-line p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={caseNode.kind === 'main' ? 'primary' : 'plain'}>{caseKindLabel[caseNode.kind]}</Badge>
        {condition === undefined ? null : <span className="text-muted">{condition}</span>}
        <span className="font-medium">{caseNode.title}</span>
        {caseNode.pending ? <Badge tone="pending">{text.label('pending')}</Badge> : null}
      </div>
      {caseNode.rows.length === 0 ? null : (
        <Table caption={caseNode.title}>
          <thead>
            <tr>
              {columns.map((column) => (
                <HeaderCell key={column}>{column}</HeaderCell>
              ))}
            </tr>
          </thead>
          <tbody>
            {caseNode.rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <Cell key={column}>{row[column] ?? ''}</Cell>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {caseNode.steps.length === 0 ? null : (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">{text.label('step')}</summary>
          <StepList label={`${caseNode.title}の${text.label('step')}`} steps={caseNode.steps} />
        </details>
      )}
      <SourcePlace file={caseNode.file} line={caseNode.line} />
    </li>
  )
}

export function ScenarioPage() {
  const { scenarioId } = scenarioRoute.useParams()
  const { scenarios, flows, pages, endpoints, works } = useModel()
  const scenario = scenarios.get(scenarioId)
  if (scenario === undefined) {
    return <PageTitle>{text.message('missingTarget')}</PageTitle>
  }
  const listWorks = (endpointIds: readonly string[]) => [
    ...new Set(endpointIds.flatMap((endpointId) => endpoints.get(endpointId)?.workIds ?? [])),
  ]
  const conditions = new Map(scenario.extensions.map((extension) => [extension.name, extension.condition]))

  return (
    <>
      <PageTitle level={`${text.label('userGoal')}（${text.label('scenario')}）`}>{scenario.title}</PageTitle>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge>
          {text.label('actor')}: {scenario.actorTitle}
        </Badge>
        {scenario.pending ? <Badge tone="pending">{text.label('pending')}</Badge> : null}
      </div>
      <p className="text-sm">{scenario.purpose}</p>
      <SourcePlace file={scenario.file} line={scenario.line} />
      <Section title={text.label('flow')}>
        <ul className="text-sm">
          {scenario.usedIn.map((use) => (
            <li key={`${use.flowId}-${use.number}`}>
              <TextLink to="/flow/$flowId" params={{ flowId: use.flowId }}>
                {flows.get(use.flowId)?.title ?? use.flowId}
              </TextLink>{' '}
              の {use.number}
            </li>
          ))}
        </ul>
      </Section>
      <Section title={text.label('primarySuccessScenario')}>
        {scenario.pending ? (
          <p className="text-sm text-muted">{text.label('pending')}</p>
        ) : (
          <StepList label={text.label('primarySuccessScenario')} steps={scenario.steps} />
        )}
      </Section>
      <Section title={text.label('successGuarantee')}>
        <StepList label={text.label('successGuarantee')} steps={scenario.guarantee} />
      </Section>
      {scenario.extensions.length === 0 ? null : (
        <Section title={text.label('extension')}>
          <Table caption={text.label('extension')}>
            <thead>
              <tr>
                <HeaderCell>{text.label('condition')}</HeaderCell>
                <HeaderCell>{text.label('handling')}</HeaderCell>
                <HeaderCell>{text.label('caseCount')}</HeaderCell>
                <HeaderCell>{text.label('flow')}</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {scenario.extensions.map((extension) => (
                <tr key={extension.name}>
                  <Cell>
                    {extension.condition} {extension.pending ? <Badge tone="pending">{text.label('pending')}</Badge> : null}
                  </Cell>
                  <Cell>{extension.handling === null ? '—' : extension.handling.join(' ')}</Cell>
                  <Cell>{extension.caseCount}</Cell>
                  <Cell>{extension.flowPaths.join('・') || '—'}</Cell>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      )}
      <Section title={`${text.label('case')}（${scenario.cases.length}）`}>
        <ul className="flex flex-col gap-2">
          {scenario.cases.map((caseNode) => (
            <CaseItem
              key={`${caseNode.file}:${caseNode.line}`}
              caseNode={caseNode}
              condition={caseNode.extension === null ? undefined : conditions.get(caseNode.extension)}
            />
          ))}
        </ul>
        {scenario.testFile === null ? null : <SourcePlace file={scenario.testFile} line={1} />}
      </Section>
      <div className="grid gap-5 md:grid-cols-2">
        <Section title={text.label('screen')}>
          <ul className="text-sm">
            {scenario.pageIds.map((pageId) => (
              <li key={pageId}>
                {pages.get(pageId)?.title ?? pageId} <span className="font-mono text-xs text-muted">{pageId}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={text.label('work')}>
          <ul className="flex flex-col gap-1 text-sm">
            {listWorks(scenario.actionEndpointIds).map((workId) => (
              <li key={workId}>
                <Badge tone="primary">{text.label('button')}</Badge>{' '}
                <TextLink to="/work/$workId" params={{ workId }}>
                  {works.get(workId)?.title ?? workId}
                </TextLink>
              </li>
            ))}
            {listWorks(scenario.queryEndpointIds).map((workId) => (
              <li key={workId}>
                <Badge>{text.label('screen')}</Badge>{' '}
                <TextLink to="/work/$workId" params={{ workId }}>
                  {works.get(workId)?.title ?? workId}
                </TextLink>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  )
}
