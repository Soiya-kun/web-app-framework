// キャンバスで開くカード。シナリオ → 処理 → SQL → テーブルと、右へ開いていく。
import type { CaseNode, FlowStepNode, StepTranslationNode } from '@app/translator/model-types'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { kindLabel } from '../component/laneLayout'
import { useModel } from '../model'
import { text } from '../text'
import { Branch } from './branch'
import { BranchToggle, Card, Fold, StepLines } from './card'

/** 開いた子のカードの ID（開いた順）。押すたびに開く・閉じるを切り替える。 */
function useOpenedList() {
  const [opened, setOpened] = useState<readonly string[]>([])
  const toggle = (id: string) => setOpened((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  return { opened, toggle }
}

function DetailLink({ to, params }: { readonly to: string; readonly params: Readonly<Record<string, string>> }) {
  return (
    <Link to={to} params={params} className="self-start text-xs text-primary underline underline-offset-2">
      {text.label('detailPage')}
    </Link>
  )
}

function StepTree({ label, steps }: { readonly label: string; readonly steps: readonly StepTranslationNode[] }) {
  return (
    <ol aria-label={label} className="flex list-decimal flex-col gap-0.5 pl-5 marker:text-muted">
      {steps.map((step, index) => (
        <li key={index}>
          {step.text}
          {step.children.length === 0 ? null : <StepTree label={step.text} steps={step.children} />}
        </li>
      ))}
    </ol>
  )
}

const caseKindLabel: Readonly<Record<CaseNode['kind'], string>> = {
  main: text.label('primarySuccessScenario'),
  vary: text.label('variation'),
  extend: text.label('extension'),
}

function CaseFold({ caseNode }: { readonly caseNode: CaseNode }) {
  const columns = [...new Set(caseNode.rows.flatMap((row) => Object.keys(row)))]
  return (
    <Fold
      title={
        <>
          <span className="mr-1 rounded bg-canvas px-1 text-[10px] font-medium">{caseKindLabel[caseNode.kind]}</span>
          <span className="font-medium text-ink">{caseNode.title}</span>
          {caseNode.pending ? <span className="ml-1 text-pending-line">{text.label('pending')}</span> : null}
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {caseNode.rows.length === 0 ? null : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col" className="border-b border-line px-1.5 py-1 text-left font-medium text-muted">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {caseNode.rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column} className="border-b border-line/60 px-1.5 py-1 align-top">
                      {row[column] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <StepLines label={caseNode.title} steps={caseNode.steps} />
      </div>
    </Fold>
  )
}

export function TableCard({ tableId }: { readonly tableId: string }) {
  const { tables } = useModel()
  const table = tables.get(tableId)
  if (table === undefined) {
    return null
  }
  return (
    <Card tone="table" kind={text.label('table')} title={table.title} width={340}>
      <p className="font-mono text-xs text-muted">{table.id}</p>
      {table.note === '' ? null : <p className="text-xs text-muted">{table.note}</p>}
      <table aria-label={`${table.title}の${text.label('column')}`} className="w-full border-collapse text-xs">
        <tbody>
          {table.columns.map((column) => (
            <tr key={column.name}>
              <td className="border-b border-line/60 py-1 pr-2">{column.title}</td>
              <td className="border-b border-line/60 py-1 pr-2 font-mono text-[11px] text-muted">{column.name}</td>
              <td className="border-b border-line/60 py-1 text-muted">{column.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <DetailLink to="/table/$tableId" params={{ tableId: table.id }} />
    </Card>
  )
}

export function StatementCard({ statementId }: { readonly statementId: string }) {
  const { statements, tables } = useModel()
  const { opened, toggle } = useOpenedList()
  const statement = statements.get(statementId)
  if (statement === undefined) {
    return null
  }
  const card = (
    <Card tone="statement" kind={text.label('statement')} title={statement.id} width={480}>
      <pre aria-label={statement.id} className="overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-[11px] leading-relaxed">
        {statement.text}
      </pre>
      <div className="flex flex-col gap-1.5">
        {statement.tableIds.map((tableId) => (
          <BranchToggle key={tableId} opened={opened.includes(tableId)} onToggle={() => toggle(tableId)}>
            <span className="rounded bg-table px-1 text-[10px] font-bold text-white">{text.label('table')}</span>
            {tables.get(tableId)?.title ?? tableId}
          </BranchToggle>
        ))}
      </div>
    </Card>
  )
  return <Branch parent={card} branches={opened.map((tableId) => ({ key: tableId, node: <TableCard tableId={tableId} /> }))} />
}

export function WorkCard({ workId }: { readonly workId: string }) {
  const { works, rules } = useModel()
  const { opened, toggle } = useOpenedList()
  const work = works.get(workId)
  if (work === undefined) {
    return null
  }
  const card = (
    <Card tone="work" kind={text.label('work')} title={work.title} width={380}>
      <p className="font-mono text-xs text-muted">{work.id}</p>
      {work.purpose === '' ? null : <p>{work.purpose}</p>}
      <Fold title={text.label('step')} count={work.steps.length} initialOpened>
        <StepTree label={`${work.title}の${text.label('step')}`} steps={work.steps} />
      </Fold>
      <Fold title={text.label('rule')} count={work.ruleIds.length}>
        <div className="flex flex-col gap-1">
          {work.ruleIds.map((ruleId) => {
            const rule = rules.get(ruleId)
            return rule === undefined ? null : (
              <Fold key={ruleId} title={<span className="font-medium text-ink">{rule.title}</span>}>
                {rule.purpose === '' ? null : <p className="text-muted">{rule.purpose}</p>}
                <StepTree label={rule.title} steps={rule.steps} />
              </Fold>
            )
          })}
        </div>
      </Fold>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-muted">{text.label('statement')}</p>
        {work.repositoryCalls.map((call) => (
          <div key={`${call.repository}.${call.method}`} className="flex flex-col gap-1">
            <span className="text-xs">{call.title}</span>
            {call.statementIds.map((statementId) => (
              <BranchToggle key={statementId} opened={opened.includes(statementId)} onToggle={() => toggle(statementId)}>
                <span className="rounded bg-statement px-1 text-[10px] font-bold text-white">{text.label('statement')}</span>
                <span className="font-mono text-xs">{statementId}</span>
              </BranchToggle>
            ))}
          </div>
        ))}
      </div>
      <DetailLink to="/work/$workId" params={{ workId: work.id }} />
    </Card>
  )
  return (
    <Branch
      parent={card}
      branches={opened.map((statementId) => ({ key: statementId, node: <StatementCard statementId={statementId} /> }))}
    />
  )
}

export function ScenarioCard({ step }: { readonly step: FlowStepNode }) {
  const { scenarios, endpoints, works } = useModel()
  const { opened, toggle } = useOpenedList()
  const scenario = step.scenarioId === null ? undefined : scenarios.get(step.scenarioId)
  if (scenario === undefined) {
    return null
  }
  const listWorks = (endpointIds: readonly string[]) => [
    ...new Set(endpointIds.flatMap((endpointId) => endpoints.get(endpointId)?.workIds ?? [])),
  ]
  const buttonWorks = listWorks(scenario.actionEndpointIds)
  const queryWorks = listWorks(scenario.queryEndpointIds).filter((workId) => !buttonWorks.includes(workId))
  const card = (
    <Card tone="scenario" kind={text.label('scenario')} title={scenario.title} width={400}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full bg-canvas px-2 py-0.5">
          {text.label('actor')}: {scenario.actorTitle}
        </span>
        {scenario.pending ? <span className="rounded-full bg-pending px-2 py-0.5 text-pending-line">{text.label('pending')}</span> : null}
      </div>
      {scenario.purpose === '' ? null : <p>{scenario.purpose}</p>}
      {step.inputs.length === 0 ? null : (
        <Fold title={text.label('input')} count={step.inputs.length} initialOpened>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            {step.inputs.map((input) => (
              <div key={input.label} className="contents">
                <dt className="text-muted">{input.label}</dt>
                <dd>{input.value}</dd>
              </div>
            ))}
          </dl>
        </Fold>
      )}
      <Fold title={text.label('primarySuccessScenario')} count={scenario.steps.length} initialOpened>
        <StepLines label={text.label('primarySuccessScenario')} steps={scenario.steps} />
      </Fold>
      <Fold title={text.label('successGuarantee')} count={scenario.guarantee.length}>
        <StepLines label={text.label('successGuarantee')} steps={scenario.guarantee} />
      </Fold>
      <Fold title={text.label('extension')} count={scenario.extensions.length}>
        <ul className="flex flex-col gap-1.5">
          {scenario.extensions.map((extension) => (
            <li key={extension.name}>
              <p className="font-medium">
                {extension.condition}
                {extension.pending ? <span className="ml-1 text-xs text-pending-line">{text.label('pending')}</span> : null}
              </p>
              {extension.handling === null ? null : <p className="text-xs text-muted">{extension.handling.join(' ')}</p>}
              <p className="text-xs text-muted">
                {text.label('caseCount')} {extension.caseCount}
                {extension.flowPaths.length === 0 ? '' : `・${extension.flowPaths.join('・')}`}
              </p>
            </li>
          ))}
        </ul>
      </Fold>
      <Fold title={text.label('case')} count={scenario.cases.length}>
        <div className="flex flex-col gap-1.5">
          {scenario.cases.map((caseNode) => (
            <CaseFold key={`${caseNode.file}:${caseNode.line}`} caseNode={caseNode} />
          ))}
        </div>
      </Fold>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-muted">{text.label('work')}</p>
        {[
          ...buttonWorks.map((workId) => [workId, text.label('button')] as const),
          ...queryWorks.map((workId) => [workId, text.label('screen')] as const),
        ].map(([workId, origin]) => (
          <BranchToggle key={workId} opened={opened.includes(workId)} onToggle={() => toggle(workId)}>
            <span className="rounded bg-work px-1 text-[10px] font-bold text-white">{origin}</span>
            {works.get(workId)?.title ?? workId}
          </BranchToggle>
        ))}
      </div>
      <DetailLink to="/scenario/$scenarioId" params={{ scenarioId: scenario.id }} />
    </Card>
  )
  return <Branch parent={card} branches={opened.map((workId) => ({ key: workId, node: <WorkCard workId={workId} /> }))} />
}

const noteMessage = {
  outside: text.message('outsideWorkNote'),
  occur: text.message('occurNote'),
  elapse: text.message('elapseNote'),
} as const

/** システムの外の業務・外のイベント・時の経過のカード。 */
export function NoteCard({ step }: { readonly step: FlowStepNode }) {
  const note = step.kind === 'outside' || step.kind === 'occur' || step.kind === 'elapse' ? noteMessage[step.kind] : ''
  return (
    <Card tone="note" kind={kindLabel[step.kind]} title={step.title} width={320}>
      {step.actorTitle === null ? null : (
        <p className="text-xs">
          {text.label('actor')}: {step.actorTitle}
        </p>
      )}
      <p className="text-xs text-muted">{note}</p>
    </Card>
  )
}
