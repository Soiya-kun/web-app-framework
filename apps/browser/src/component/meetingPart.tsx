// 議事録の部品。課題・決めたことが指している場所（業務フロー・シナリオ・拡張・画面・処理など）へのリンクと、課題の状態（未解決・期日超過・解決済み）。
import type { DecisionNode, FlowNode, MeetingPlaceNode, QuestionNode, ScenarioNode, WorkNode } from '@app/translator/model-types'
import type { ModelTable } from '../model'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'
import { Badge, Section, TextLink } from './part'

/** 今日の日付（YYYY-MM-DD）。期日超過を決めるのに使う。 */
export function readTodayText(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())
}

/** その場所に付くかどうか。 */
export type PlaceMatch = (place: MeetingPlaceNode) => boolean

type PlaceDecision = DecisionNode & { readonly meetingId: string; readonly date: string }

/** 業務フローの段にあるシナリオ（拡張の中の段を含む）。 */
function listScenarioIds(flow: FlowNode): Set<string> {
  const scenarioIds = new Set<string>()
  const readSteps = (steps: FlowNode['steps']): void => {
    for (const step of steps) {
      if (step.scenarioId !== null) {
        scenarioIds.add(step.scenarioId)
      }
      step.extensions.forEach((extension) => readSteps(extension.then))
    }
  }
  readSteps(flow.steps)
  return scenarioIds
}

/** 業務フローに付くもの。業務フローそのものと、その段のシナリオ・拡張に付いたもの。 */
export function prepareFlowMatch(flow: FlowNode): PlaceMatch {
  const scenarioIds = listScenarioIds(flow)
  return (place) => (place.kind === 'flow' && place.id === flow.id) || ((place.kind === 'scenario' || place.kind === 'extension') && scenarioIds.has(place.id))
}

/** シナリオに付くもの。シナリオとその拡張、シナリオが開く画面と通る処理に付いたもの。 */
export function prepareScenarioMatch(scenario: ScenarioNode): PlaceMatch {
  return (place) =>
    ((place.kind === 'scenario' || place.kind === 'extension') && place.id === scenario.id) ||
    (place.kind === 'page' && scenario.pageIds.includes(place.id)) ||
    (place.kind === 'work' && scenario.workIds.includes(place.id))
}

/** 処理に付くもの。処理とその規則に付いたもの。 */
export function prepareWorkMatch(work: WorkNode): PlaceMatch {
  return (place) => (place.kind === 'work' && place.id === work.id) || (place.kind === 'rule' && work.ruleIds.includes(place.id))
}

/** その場所に付く課題。解決していないものを先にする。 */
export function selectQuestions(table: ModelTable, matchPlace: PlaceMatch): QuestionNode[] {
  return table.model.questions.filter((question) => question.places.some(matchPlace)).sort((left, right) => Number(left.decision !== null) - Number(right.decision !== null))
}

/** 業務フローに付く課題（その段のシナリオ・拡張に付いた課題を含む）。 */
export function selectFlowQuestions(table: ModelTable, flow: FlowNode): QuestionNode[] {
  return selectQuestions(table, prepareFlowMatch(flow))
}

/** 指している場所へのリンク（業務フロー・シナリオ・拡張・処理はその画面。画面・規則などは名前だけ）。 */
export function PlaceLink({ place }: { readonly place: MeetingPlaceNode }) {
  switch (place.kind) {
    case 'flow':
      return (
        <TextLink to="/flow/$flowId" params={{ flowId: place.id }}>
          {place.title}
        </TextLink>
      )
    case 'scenario':
    case 'extension':
      return (
        <TextLink to="/scenario/$scenarioId" params={{ scenarioId: place.id }}>
          {place.title}
        </TextLink>
      )
    case 'work':
      return (
        <TextLink to="/work/$workId" params={{ workId: place.id }}>
          {place.title}
        </TextLink>
      )
    default:
      return <span title={place.id}>{place.title}</span>
  }
}

/** 指している場所の並び。 */
export function PlaceList({ places }: { readonly places: readonly MeetingPlaceNode[] }) {
  const labelFormat = useLabelFormat()
  return (
    <>
      {places.map((place, index) => (
        <span key={`${place.kind}-${place.id}-${place.extension ?? ''}`}>
          {index === 0 ? null : labelFormat.mark}
          <PlaceLink place={place} />
        </span>
      ))}
    </>
  )
}

/** 課題の状態の印。 */
export function QuestionStatus({ question }: { readonly question: QuestionNode }) {
  const text = useText()
  if (question.decision !== null) {
    return <Badge>{text.label('resolved')}</Badge>
  }
  return question.deadline < readTodayText() ? <Badge tone="pending">{text.label('overdue')}</Badge> : <Badge tone="pending">{text.label('unresolved')}</Badge>
}

/** 課題1件（内容・担当者・期限・状態・解決した決定）。displayPlace なら、指している場所も出す。 */
export function QuestionItem({ question, displayPlace = false }: { readonly question: QuestionNode; readonly displayPlace?: boolean }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { roles, meetings } = useModel()
  const raisedMeeting = meetings.get(question.meetingId)
  const resolvedMeeting = question.decision === null ? undefined : meetings.get(question.decision.meetingId)
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        <QuestionStatus question={question} /> {question.text}
      </p>
      <p className="text-xs text-muted">
        {displayPlace ? (
          <>
            <PlaceList places={question.places} />
            {labelFormat.mark}
          </>
        ) : null}
        {text.label('assignee')}: {roles.get(question.assigneeId)?.title ?? question.assigneeId}
        {labelFormat.mark}
        {text.label('deadline')}: {question.deadline}
        {labelFormat.mark}
        <TextLink to="/meeting/$meetingId" params={{ meetingId: question.meetingId }}>
          {raisedMeeting?.date ?? question.date}
        </TextLink>
      </p>
      {question.decision === null ? null : (
        <p className="text-xs">
          {text.label('decision')}: {question.decision.text}
          {labelFormat.mark}
          <TextLink to="/meeting/$meetingId" params={{ meetingId: question.decision.meetingId }}>
            {resolvedMeeting?.date ?? question.decision.date}
          </TextLink>
        </p>
      )}
    </div>
  )
}

/** 決めたこと1件（指している場所・決めたこと・解決した課題）。 */
export function DecisionItem({ decision, meetingId }: { readonly decision: DecisionNode; readonly meetingId?: string }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { meetings, questions } = useModel()
  const question = decision.questionId === null ? undefined : questions.get(decision.questionId)
  const meeting = meetingId === undefined ? undefined : meetings.get(meetingId)
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <p className="text-xs text-muted">
        <PlaceList places={decision.places} />
        {meeting === undefined ? null : (
          <>
            {labelFormat.mark}
            <TextLink to="/meeting/$meetingId" params={{ meetingId: meeting.id }}>
              {meeting.date}
            </TextLink>
          </>
        )}
      </p>
      <p>{decision.text}</p>
      {question === undefined ? null : (
        <p className="text-xs text-muted">
          {text.label('resolvedQuestion')}: {question.text}
          {labelFormat.mark}
          <TextLink to="/meeting/$meetingId" params={{ meetingId: question.meetingId }}>
            {question.date}
          </TextLink>
        </p>
      )}
    </div>
  )
}

/** 業務フロー・シナリオ・処理のページに出す、その場所の課題と決めたこと（どの打合せで決めたか）。 */
export function PlaceMinutes({ matchPlace }: { readonly matchPlace: PlaceMatch }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const table = useModel()
  const questions = selectQuestions(table, matchPlace)
  const decisionList: PlaceDecision[] = table.model.meetings.flatMap((meeting) =>
    meeting.decisions.filter((decision) => decision.places.some(matchPlace)).map((decision) => ({ meetingId: meeting.id, date: meeting.date, ...decision })),
  )
  return (
    <>
      {questions.length === 0 ? null : (
        <Section title={labelFormat.joinNote(text.label('question'), String(questions.length))}>
          <ul className="flex flex-col gap-3">
            {questions.map((question) => (
              <li key={question.id}>
                <QuestionItem question={question} displayPlace />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {decisionList.length === 0 ? null : (
        <Section title={labelFormat.joinNote(text.label('decision'), String(decisionList.length))}>
          <ul className="flex flex-col gap-3">
            {decisionList.map((decision) => (
              <li key={`${decision.meetingId}-${decision.text}`}>
                <DecisionItem decision={decision} meetingId={decision.meetingId} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
