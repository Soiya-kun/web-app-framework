import { getRouteApi } from '@tanstack/react-router'
import { PageTitle, Section, SourcePlace, TextLink } from '../component/part'
import { useModel } from '../model'
import { text } from '../text'

const statementRoute = getRouteApi('/statement/$statementId')

export function StatementPage() {
  const { statementId } = statementRoute.useParams()
  const { model, statements, tables } = useModel()
  const statement = statements.get(statementId)
  if (statement === undefined) {
    return <PageTitle>{text.message('missingTarget')}</PageTitle>
  }
  const usingWorks = model.works.filter((work) => work.repositoryCalls.some((call) => call.statementIds.includes(statement.id)))

  return (
    <>
      <PageTitle level={text.label('statement')}>{statement.id}</PageTitle>
      <SourcePlace file={statement.file} line={statement.line} />
      <pre
        aria-label={statement.id}
        className="overflow-x-auto rounded-control border border-line bg-surface p-4 font-mono text-xs leading-relaxed"
      >
        {statement.text}
      </pre>
      <div className="grid gap-5 md:grid-cols-2">
        <Section title={text.label('table')}>
          <ul className="text-sm">
            {statement.tableIds.map((tableId) => (
              <li key={tableId}>
                <TextLink to="/table/$tableId" params={{ tableId }}>
                  {tables.get(tableId)?.title ?? tableId}
                </TextLink>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={text.label('work')}>
          <ul className="text-sm">
            {usingWorks.map((work) => (
              <li key={work.id}>
                <TextLink to="/work/$workId" params={{ workId: work.id }}>
                  {work.title}
                </TextLink>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  )
}
