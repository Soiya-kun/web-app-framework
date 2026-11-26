// キャンバスで開くカード。シナリオ → 処理 → SQL → テーブルと、右へ開いていく。
// 開いた子のカードはキャンバスの状態に保存する（カードの道筋 path ごと。子は work:… のように種類を頭に付ける）。
import type { CaseNode, FlowStepNode, StepTranslationNode } from '@app/translator/model-types'
import { Link } from '@tanstack/react-router'
import { readCaseKindLabels, readStepKindLabels } from '../component/kindLabel'
import { prepareScenarioMatch, QuestionItem, selectQuestions } from '../component/meetingPart'
import { useModel } from '../model'
import { useText, useLabelFormat } from '../text'
import { Branch, type BranchChild } from './branch'
import { BranchToggle, Card, Fold, StepLines } from './card'
import { emptyList, toggleBranch, useCanvasState, useCanvasStore } from './canvasStore'
import { MockLink } from '../component/mockLink'

/** カードの右に開いた子（開いた順）と、開閉の切り替え。 */
function useBranches(path: string) {
  const store = useCanvasStore()
  const opened = useCanvasState((state) => state.branches[path] ?? emptyList)
  return { opened, toggle: (child: string) => toggleBranch(store, path, child) }
}

function DetailLink({ to, params }: { readonly to: string; readonly params: Readonly<Record<string, string>> }) {
  const text = useText()
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

function CaseFold({ path, caseNode }: { readonly path: string; readonly caseNode: CaseNode }) {
  const text = useText()
  const caseKindLabel = readCaseKindLabels(text)
  const columns = [...new Set(caseNode.rows.flatMap((row) => Object.keys(row)))]
  return (
    <Fold
      path={path}
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

export function TableCard({ path, tableId }: { readonly path: string; readonly tableId: string }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { tables } = useModel()
  const table = tables.get(tableId)
  if (table === undefined) {
    return null
  }
  return (
    <Card path={path} tone="table" kind={text.label('table')} title={table.title} width={340}>
      <p className="font-mono text-xs text-muted">{table.id}</p>
      {table.note === '' ? null : <p className="text-xs text-muted">{table.note}</p>}
      <table aria-label={labelFormat.joinItem(table.title, text.label('column'))} className="w-full border-collapse text-xs">
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

export function StatementCard({ path, statementId }: { readonly path: string; readonly statementId: string }) {
  const text = useText()
  const { statements, tables } = useModel()
  const { opened, toggle } = useBranches(path)
  const statement = statements.get(statementId)
  if (statement === undefined) {
    return null
  }
  const card = (
    <Card path={path} tone="statement" kind={text.label('statement')} title={statement.id} width={480}>
      <pre aria-label={statement.id} className="overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-[11px] leading-relaxed">
        {statement.text}
      </pre>
      <div className="flex flex-col gap-1.5">
        {statement.tableIds.map((tableId) => (
          <BranchToggle key={tableId} opened={opened.includes(`table:${tableId}`)} onToggle={() => toggle(`table:${tableId}`)}>
            <span className="rounded bg-table px-1 text-[10px] font-bold text-white">{text.label('table')}</span>
            {tables.get(tableId)?.title ?? tableId}
          </BranchToggle>
        ))}
      </div>
    </Card>
  )
  return (
    <Branch
      parent={card}
      branches={opened.map((child) => ({
        key: child,
        node: <TableCard path={`${path}/${child}`} tableId={child.slice('table:'.length)} />,
      }))}
    />
  )
}

export function WorkCard({ path, workId }: { readonly path: string; readonly workId: string }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { works, rules } = useModel()
  const { opened, toggle } = useBranches(path)
  const work = works.get(workId)
  if (work === undefined) {
    return null
  }
  const card = (
    <Card path={path} tone="work" kind={text.label('work')} title={work.title} width={380}>
      <p className="font-mono text-xs text-muted">{work.id}</p>
      <Fold path={`${path}#step`} title={text.label('step')} count={work.steps.length} initialOpened>
        <StepTree label={labelFormat.joinItem(work.title, text.label('step'))} steps={work.steps} />
      </Fold>
      <Fold path={`${path}#rule`} title={text.label('rule')} count={work.ruleIds.length}>
        <div className="flex flex-col gap-1">
          {work.ruleIds.map((ruleId) => {
            const rule = rules.get(ruleId)
            return rule === undefined ? null : (
              <Fold key={ruleId} path={`${path}#rule:${ruleId}`} title={<span className="font-medium text-ink">{rule.title}</span>}>
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
              <BranchToggle
                key={statementId}
                opened={opened.includes(`statement:${statementId}`)}
                onToggle={() => toggle(`statement:${statementId}`)}
              >
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
      branches={opened.map((child) => ({
        key: child,
        node: <StatementCard path={`${path}/${child}`} statementId={child.slice('statement:'.length)} />,
      }))}
    />
  )
}

/** 段の拡張の流れ（then の段）を、名前で引けるようにする。 */
function listExtensionSteps(step: FlowStepNode): ReadonlyMap<string, FlowStepNode> {
  return new Map(step.extensions.flatMap((extension) => extension.then.map((following) => [following.number, following] as const)))
}

export function ScenarioCard({ path, step }: { readonly path: string; readonly step: FlowStepNode }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const table = useModel()
  const { scenarios, endpoints, works } = table
  const { opened, toggle } = useBranches(path)
  const scenario = step.scenarioId === null ? undefined : scenarios.get(step.scenarioId)
  if (scenario === undefined) {
    return null
  }
  const scenarioQuestions = selectQuestions(table, prepareScenarioMatch(scenario))
  const listWorks = (endpointIds: readonly string[]) => [
    ...new Set(endpointIds.flatMap((endpointId) => endpoints.get(endpointId)?.workIds ?? [])),
  ]
  const buttonWorks = listWorks(scenario.actionEndpointIds)
  const queryWorks = listWorks(scenario.queryEndpointIds).filter((workId) => !buttonWorks.includes(workId))
  const extensionSteps = listExtensionSteps(step)
  const card = (
    <Card path={path} tone="scenario" kind={text.label('scenario')} title={scenario.title} width={400}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full bg-canvas px-2 py-0.5">
          {text.label('actor')}: {scenario.actorTitle}
        </span>
        {scenario.pending ? <span className="rounded-full bg-pending px-2 py-0.5 text-pending-line">{text.label('pending')}</span> : null}
      </div>
      {step.inputs.length === 0 ? null : (
        <Fold path={`${path}#input`} title={text.label('input')} count={step.inputs.length} initialOpened>
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
      <Fold path={`${path}#main`} title={text.label('primarySuccessScenario')} count={scenario.steps.length} initialOpened>
        <StepLines label={text.label('primarySuccessScenario')} steps={scenario.steps} />
      </Fold>
      <Fold path={`${path}#guarantee`} title={text.label('successGuarantee')} count={scenario.guarantee.length}>
        <StepLines label={text.label('successGuarantee')} steps={scenario.guarantee} />
      </Fold>
      <Fold path={`${path}#extension`} title={text.label('extension')} count={scenario.extensions.length}>
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
                {extension.flowPaths.length === 0 ? '' : `${labelFormat.mark}${labelFormat.joinList(extension.flowPaths)}`}
              </p>
            </li>
          ))}
        </ul>
      </Fold>
      <Fold path={`${path}#case`} title={text.label('case')} count={scenario.cases.length}>
        <div className="flex flex-col gap-1.5">
          {scenario.cases.map((caseNode) => (
            <CaseFold key={`${caseNode.file}:${caseNode.line}`} path={`${path}#case:${caseNode.line}`} caseNode={caseNode} />
          ))}
        </div>
      </Fold>
      {scenarioQuestions.length === 0 ? null : (
        <Fold path={`${path}#question`} title={text.label('question')} count={scenarioQuestions.length} initialOpened={scenarioQuestions.some((question) => question.decision === null)}>
          <ul className="flex flex-col gap-2">
            {scenarioQuestions.map((question) => (
              <li key={question.id}>
                <QuestionItem question={question} displayPlace={question.places.some((place) => place.kind !== 'scenario')} />
              </li>
            ))}
          </ul>
        </Fold>
      )}
      {step.extensions.length === 0 ? null : (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-bold text-muted">{text.label('flowExtension')}</p>
          {step.extensions.map((extension) => (
            <div key={extension.key} className="flex flex-col gap-1 rounded-lg bg-canvas/70 p-2">
              <p className="text-xs font-medium">
                {extension.key}. {extension.condition}
              </p>
              {extension.then.map((following) => (
                <BranchToggle
                  key={following.number}
                  opened={opened.includes(`step:${following.number}`)}
                  onToggle={() => toggle(`step:${following.number}`)}
                >
                  <span className="text-[10px] text-muted">{following.number}</span>
                  {following.title}
                </BranchToggle>
              ))}
              <p className="text-[11px] text-muted">{extension.resume ? text.message('returnMainline') : text.message('endCourse')}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-muted">{text.label('work')}</p>
        {[
          ...buttonWorks.map((workId) => [workId, text.label('button')] as const),
          ...queryWorks.map((workId) => [workId, text.label('screen')] as const),
        ].map(([workId, origin]) => (
          <BranchToggle key={workId} opened={opened.includes(`work:${workId}`)} onToggle={() => toggle(`work:${workId}`)}>
            <span className="rounded bg-work px-1 text-[10px] font-bold text-white">{origin}</span>
            {works.get(workId)?.title ?? workId}
          </BranchToggle>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <DetailLink to="/scenario/$scenarioId" params={{ scenarioId: scenario.id }} />
        {step.kind === 'operate' ? <MockLink flowId={path.split(':')[0] ?? ''} number={step.number} /> : null}
      </div>
    </Card>
  )
  const branches: BranchChild[] = opened.flatMap((child) => {
    const childPath = `${path}/${child}`
    if (child.startsWith('work:')) {
      return [{ key: child, node: <WorkCard path={childPath} workId={child.slice('work:'.length)} /> }]
    }
    const following = extensionSteps.get(child.slice('step:'.length))
    if (following === undefined) {
      return []
    }
    return [
      {
        key: child,
        node:
          following.kind === 'operate' ? (
            <ScenarioCard path={childPath} step={following} />
          ) : (
            <NoteCard path={childPath} step={following} />
          ),
      },
    ]
  })
  return <Branch parent={card} branches={branches} />
}

/** システムの外の業務・外のイベント・時の経過のカード。 */
export function NoteCard({ path, step }: { readonly path: string; readonly step: FlowStepNode }) {
  const text = useText()
  const kindLabel = readStepKindLabels(text)
  const noteMessage = { outside: text.message('outsideWorkNote'), occur: text.message('occurNote'), elapse: text.message('elapseNote') } as const
  const note = step.kind === 'outside' || step.kind === 'occur' || step.kind === 'elapse' ? noteMessage[step.kind] : ''
  return (
    <Card path={path} tone="note" kind={kindLabel[step.kind]} title={step.title} width={320}>
      {step.actorTitle === null ? null : (
        <p className="text-xs">
          {text.label('actor')}: {step.actorTitle}
        </p>
      )}
      <p className="text-xs text-muted">{note}</p>
    </Card>
  )
}
