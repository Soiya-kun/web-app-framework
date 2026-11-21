// 議事録の部品。課題が話している場所（業務フロー・シナリオ・拡張）へのリンクと、課題の状態（未回答・期日超過・回答済み）。
import type { FlowNode, MeetingPlaceNode, QuestionNode } from '@app/translator/model-types'
import type { ModelTable } from '../model'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'
import { Badge, Section, TextLink } from './part'

/** 今日の日付（YYYY-MM-DD）。期日超過を決めるのに使う。 */
export function readTodayText(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())
}

type PlaceDecision = { readonly meetingId: string; readonly date: string; readonly place: MeetingPlaceNode; readonly text: string }

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

/** その場所（業務フロー・シナリオ）に付くかどうか。業務フローには、その段のシナリオ・拡張に付いたものも含める。 */
function preparePlaceMatch(flow: FlowNode | undefined, scenarioId: string | undefined): (place: MeetingPlaceNode) => boolean {
  const scenarioIds = flow === undefined ? new Set<string>() : listScenarioIds(flow)
  return (place) =>
    (flow !== undefined && (place.flowId === flow.id || (place.scenarioId !== null && scenarioIds.has(place.scenarioId)))) ||
    (scenarioId !== undefined && place.scenarioId === scenarioId)
}

/** 業務フローに付く課題。業務フローそのものと、その段のシナリオ・拡張に付いた課題を集める。 */
export function selectFlowQuestions(table: ModelTable, flow: FlowNode): QuestionNode[] {
  const matchPlace = preparePlaceMatch(flow, undefined)
  return table.model.questions.filter((question) => matchPlace(question.place))
}

/** シナリオ（とその拡張）に付く課題。 */
export function selectScenarioQuestions(table: ModelTable, scenarioId: string): QuestionNode[] {
  return table.model.questions.filter((question) => question.place.scenarioId === scenarioId)
}

/** 課題が話している場所へのリンク（業務フローはその画面、シナリオ・拡張はシナリオの画面）。 */
export function PlaceLink({ place }: { readonly place: MeetingPlaceNode }) {
  if (place.flowId !== null) {
    return (
      <TextLink to="/flow/$flowId" params={{ flowId: place.flowId }}>
        {place.title}
      </TextLink>
    )
  }
  return place.scenarioId === null ? (
    <>{place.title}</>
  ) : (
    <TextLink to="/scenario/$scenarioId" params={{ scenarioId: place.scenarioId }}>
      {place.title}
    </TextLink>
  )
}

/** 課題の状態の印。 */
export function QuestionStatus({ question }: { readonly question: QuestionNode }) {
  const text = useText()
  if (question.answer !== null) {
    return <Badge>{text.label('answered')}</Badge>
  }
  return question.deadline < readTodayText() ? <Badge tone="pending">{text.label('overdue')}</Badge> : <Badge tone="pending">{text.label('unanswered')}</Badge>
}

/** 課題1件（内容・担当者・期限・状態・回答）。displayPlace なら、話している場所も出す。 */
export function QuestionItem({ question, displayPlace = false }: { readonly question: QuestionNode; readonly displayPlace?: boolean }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { roles, meetings } = useModel()
  const raisedMeeting = meetings.get(question.meetingId)
  const answeredMeeting = question.answer === null ? undefined : meetings.get(question.answer.meetingId)
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        <QuestionStatus question={question} /> {question.text}
      </p>
      <p className="text-xs text-muted">
        {displayPlace ? (
          <>
            <PlaceLink place={question.place} />
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
      {question.answer === null ? null : (
        <p className="text-xs">
          {text.label('answer')}: {question.answer.text}
          {labelFormat.mark}
          <TextLink to="/meeting/$meetingId" params={{ meetingId: question.answer.meetingId }}>
            {answeredMeeting?.date ?? question.answer.date}
          </TextLink>
        </p>
      )}
    </div>
  )
}

/** 業務フロー・シナリオのページに出す、その場所の課題と決めたこと（どの打合せで決めたか）。 */
export function PlaceMinutes({ flow, scenarioId }: { readonly flow?: FlowNode; readonly scenarioId?: string }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { model } = useModel()
  const matchPlace = preparePlaceMatch(flow, scenarioId)
  const questions = model.questions.filter((question) => matchPlace(question.place)).sort((left, right) => Number(left.answer !== null) - Number(right.answer !== null))
  const decisionList: PlaceDecision[] = model.meetings.flatMap((meeting) =>
    meeting.decisions.filter((decision) => matchPlace(decision.place)).map((decision) => ({ meetingId: meeting.id, date: meeting.date, ...decision })),
  )
  if (questions.length === 0 && decisionList.length === 0) {
    return null
  }
  return (
    <>
      <Section title={labelFormat.joinNote(text.label('question'), String(questions.length))}>
        <ul className="flex flex-col gap-3">
          {questions.map((question) => (
            <li key={question.id}>
              <QuestionItem question={question} displayPlace />
            </li>
          ))}
        </ul>
      </Section>
      <Section title={labelFormat.joinNote(text.label('decision'), String(decisionList.length))}>
        <ul className="flex flex-col gap-3 text-sm">
          {decisionList.map((decision) => (
            <li key={`${decision.meetingId}-${decision.text}`} className="flex flex-col gap-0.5">
              <p className="text-xs text-muted">
                <PlaceLink place={decision.place} />
                {labelFormat.mark}
                <TextLink to="/meeting/$meetingId" params={{ meetingId: decision.meetingId }}>
                  {decision.date}
                </TextLink>
              </p>
              <p>{decision.text}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
