import type { RoleNode } from '@app/translator/model-types'
import { QuestionItem } from '../component/meetingPart'
import { Badge, Cell, HeaderCell, PageTitle, Section, Table, TextLink } from '../component/part'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'

const sides: readonly RoleNode['side'][] = ['vendor', 'business', 'external']

/** 議事録の一覧・まだ回答のない課題（宿題）・役割。業務部門にもそのまま見せる。 */
export function MeetingListPage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { model } = useModel()
  const openQuestions = model.questions.filter((question) => question.answer === null).sort((left, right) => left.deadline.localeCompare(right.deadline))

  return (
    <>
      <PageTitle>{text.label('minutes')}</PageTitle>
      <Section title={labelFormat.joinNote(text.label('unanswered'), String(openQuestions.length))}>
        <ul className="flex flex-col gap-3">
          {openQuestions.map((question) => (
            <li key={question.id}>
              <QuestionItem question={question} displayPlace />
            </li>
          ))}
        </ul>
      </Section>
      <Section title={labelFormat.joinNote(text.label('minutes'), String(model.meetings.length))}>
        <Table caption={text.label('minutes')}>
          <thead>
            <tr>
              <HeaderCell>{text.label('date')}</HeaderCell>
              <HeaderCell>{text.label('title')}</HeaderCell>
              <HeaderCell>{text.label('approval')}</HeaderCell>
              <HeaderCell>{text.label('decision')}</HeaderCell>
              <HeaderCell>{text.label('question')}</HeaderCell>
              <HeaderCell>{text.label('answer')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {[...model.meetings].reverse().map((meeting) => (
              <tr key={meeting.id}>
                <Cell>{meeting.date}</Cell>
                <Cell>
                  <TextLink to="/meeting/$meetingId" params={{ meetingId: meeting.id }}>
                    {meeting.title}
                  </TextLink>
                </Cell>
                <Cell>{meeting.approval === null ? <Badge tone="pending">{text.label('unapproved')}</Badge> : meeting.approval.on}</Cell>
                <Cell>{meeting.decisions.length}</Cell>
                <Cell>{meeting.questionIds.length}</Cell>
                <Cell>{meeting.answers.length}</Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      <Section title={text.label('role')}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {sides.map((side) => (
            <div key={side} className="flex flex-col gap-1">
              <dt className="text-xs font-bold text-muted">{text.label(side)}</dt>
              <dd>{labelFormat.joinList(model.roles.filter((role) => role.side === side).map((role) => role.title))}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  )
}
