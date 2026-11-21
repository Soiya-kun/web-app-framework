import type { RoleNode } from '@app/translator/model-types'
import { getRouteApi } from '@tanstack/react-router'
import { PlaceLink, QuestionItem } from '../component/meetingPart'
import { Badge, PageTitle, Section, SourcePlace } from '../component/part'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'

const meetingRoute = getRouteApi('/meeting/$meetingId')
const sides: readonly RoleNode['side'][] = ['vendor', 'business', 'external']

/** 1回の打合せの議事録。業務部門がレビューし、承認する。 */
export function MeetingPage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { meetingId } = meetingRoute.useParams()
  const { meetings, questions, roles } = useModel()
  const meeting = meetings.get(meetingId)
  if (meeting === undefined) {
    return <PageTitle>{meetingId}</PageTitle>
  }
  const attendees = meeting.attendeeIds.flatMap((roleId) => {
    const role = roles.get(roleId)
    return role === undefined ? [] : [role]
  })

  return (
    <>
      <PageTitle level={labelFormat.joinNote(text.label('minutes'), meeting.date)}>{meeting.title}</PageTitle>
      <p className="text-sm">
        {meeting.approval === null ? (
          <Badge tone="pending">{text.label('unapproved')}</Badge>
        ) : (
          <Badge tone="primary">
            {text.label('approved')}
            {labelFormat.mark}
            {meeting.approval.on}
            {labelFormat.mark}
            {roles.get(meeting.approval.byId)?.title ?? meeting.approval.byId}
          </Badge>
        )}
      </p>
      <SourcePlace file={meeting.file} line={meeting.line} />
      <Section title={text.label('attendee')}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {sides
            .filter((side) => attendees.some((role) => role.side === side))
            .map((side) => (
              <div key={side} className="flex flex-col gap-1">
                <dt className="text-xs font-bold text-muted">{text.label(side)}</dt>
                <dd>{labelFormat.joinList(attendees.filter((role) => role.side === side).map((role) => role.title))}</dd>
              </div>
            ))}
        </dl>
      </Section>
      <Section title={text.label('agenda')}>
        <ul className="flex flex-col gap-1 text-sm">
          {meeting.agenda.map((place) => (
            <li key={`${place.kind}-${place.flowId ?? ''}-${place.scenarioId ?? ''}-${place.extension ?? ''}`}>
              <PlaceLink place={place} />
            </li>
          ))}
        </ul>
      </Section>
      <Section title={labelFormat.joinNote(text.label('answer'), String(meeting.answers.length))}>
        <ul className="flex flex-col gap-3 text-sm">
          {meeting.answers.map((answer) => {
            const question = questions.get(answer.questionId)
            return (
              <li key={answer.questionId} className="flex flex-col gap-0.5">
                <p className="text-muted">
                  {question === undefined ? answer.questionId : question.text}
                  {question === undefined ? null : (
                    <>
                      {labelFormat.mark}
                      <PlaceLink place={question.place} />
                    </>
                  )}
                </p>
                <p>{answer.text}</p>
              </li>
            )
          })}
        </ul>
      </Section>
      <Section title={labelFormat.joinNote(text.label('decision'), String(meeting.decisions.length))}>
        <ul className="flex flex-col gap-3 text-sm">
          {meeting.decisions.map((decision) => (
            <li key={decision.text} className="flex flex-col gap-0.5">
              <p className="text-xs text-muted">
                <PlaceLink place={decision.place} />
              </p>
              <p>{decision.text}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={labelFormat.joinNote(text.label('question'), String(meeting.questionIds.length))}>
        <ul className="flex flex-col gap-3">
          {meeting.questionIds.map((questionId) => {
            const question = questions.get(questionId)
            return question === undefined ? null : (
              <li key={questionId}>
                <QuestionItem question={question} displayPlace />
              </li>
            )
          })}
        </ul>
      </Section>
    </>
  )
}
