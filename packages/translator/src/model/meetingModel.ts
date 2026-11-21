// 議事録（apps/web/meeting の defineMeeting）を読む。決めたこと・課題・回答・承認を、業務フロー・シナリオ・拡張と役割につなぐ。
// 課題が解決したかどうかは議事録に書かない。後の打合せの回答（answer）をたどって求める。
import { findUnknownTokens } from '@app/vocabulary'
import ts from 'typescript'
import type { ScenarioDraft } from './flowModel'
import { lineOf, listExportedCalls, readProperty, readString, unwrap, type ParsedSource, type SourceReader } from './source'
import type { FlowNode, MeetingNode, MeetingPlaceNode, ModelProblem, QuestionNode, RoleNode } from './types'

export const meetingRoot = 'apps/web/meeting'

export type MeetingModel = {
  readonly meetings: MeetingNode[]
  readonly questions: QuestionNode[]
}

type Tables = {
  readonly roles: ReadonlyMap<string, RoleNode>
  readonly flows: ReadonlyMap<string, FlowNode>
  readonly scenarios: ReadonlyMap<string, ScenarioDraft>
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/

/** 名前（識別子）が指す、import した定義の場所（ファイル#名前）。同じファイルの定義なら、そのファイル。 */
function placeKeyOf(parsed: ParsedSource, node: ts.Expression | undefined): string | undefined {
  const inner = node === undefined ? undefined : unwrap(node)
  if (inner === undefined || !ts.isIdentifier(inner)) {
    return undefined
  }
  const imported = parsed.imports.get(inner.text)
  return imported === undefined ? `${parsed.file}#${inner.text}` : `${imported.file}#${imported.name}`
}

/** 議事録の項目が話している場所（業務フロー・シナリオ・拡張）。 */
function readPlace(parsed: ParsedSource, node: ts.Expression | undefined, tables: Tables): MeetingPlaceNode | undefined {
  const inner = node === undefined ? undefined : unwrap(node)
  if (inner !== undefined && ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === 'extensionOf') {
    const scenario = tables.scenarios.get(placeKeyOf(parsed, inner.arguments[0]) ?? '')
    const extension = readString(inner.arguments[1])
    const condition = scenario?.extensions.find((candidate) => candidate.name === extension)?.condition
    return scenario === undefined || extension === undefined || condition === undefined
      ? undefined
      : { kind: 'extension', flowId: null, scenarioId: scenario.id, extension, title: `${scenario.title} › ${condition}` }
  }
  const key = placeKeyOf(parsed, inner)
  const flow = tables.flows.get(key ?? '')
  if (flow !== undefined) {
    return { kind: 'flow', flowId: flow.id, scenarioId: null, extension: null, title: flow.title }
  }
  const scenario = tables.scenarios.get(key ?? '')
  return scenario === undefined ? undefined : { kind: 'scenario', flowId: null, scenarioId: scenario.id, extension: null, title: scenario.title }
}

function readArray(node: ts.Expression | undefined): readonly ts.Expression[] {
  const inner = node === undefined ? undefined : unwrap(node)
  return inner !== undefined && ts.isArrayLiteralExpression(inner) ? inner.elements : []
}

function callOf(node: ts.Expression, calleeName: string): ts.CallExpression | undefined {
  const inner = unwrap(node)
  return ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === calleeName ? inner : undefined
}

export function readMeetingModel(reader: SourceReader, tables: Tables, problems: ModelProblem[]): MeetingModel {
  const meetings: MeetingNode[] = []
  const questions: QuestionNode[] = []
  const pendingAnswers: { readonly questionKey: string; readonly meetingId: string; readonly date: string; readonly text: string; readonly file: string; readonly line: number }[] = []
  const questionByKey = new Map<string, QuestionNode>()

  for (const file of reader.list(meetingRoot, (path) => path.endsWith('.ts') && !path.endsWith('.test.ts'))) {
    const parsed = reader.read(file)
    for (const { name: variable, call } of listExportedCalls(parsed, 'defineMeeting')) {
      const place = { file, line: lineOf(parsed, call) }
      const date = readString(call.arguments[0]) ?? ''
      if (!datePattern.test(date) || variable !== `meeting${date.replace(/-/g, '')}`) {
        problems.push({ ...place, rule: 'meeting', message: `議事録の日付「${date}」は YYYY-MM-DD にし、変数の名前を meeting と日付（meeting${date.replace(/-/g, '')}）にする` })
      }
      const options = call.arguments[1]
      if (options === undefined || !ts.isObjectLiteralExpression(options)) {
        problems.push({ ...place, rule: 'meeting', message: '議事録の2つめの引数は { title, attendees, agenda, decisions, questions, answers, approval } にする' })
        continue
      }
      const placeOf = (node: ts.Expression | undefined, at: ts.Node): MeetingPlaceNode | undefined => {
        const resolved = readPlace(parsed, node, tables)
        if (resolved === undefined) {
          problems.push({ file, line: lineOf(parsed, at), rule: 'meeting-place', message: '議事録の項目は、業務フロー・シナリオ・extensionOf(シナリオ, 拡張) を import して指す' })
        }
        return resolved
      }
      const roleOf = (node: ts.Expression | undefined, at: ts.Node): RoleNode | undefined => {
        const role = tables.roles.get(placeKeyOf(parsed, node) ?? '')
        if (role === undefined) {
          problems.push({ file, line: lineOf(parsed, at), rule: 'meeting-role', message: '出席者・担当者・承認者は、apps/web/role の defineRole の役割を import して渡す' })
        }
        return role
      }

      const attendeeIds = readArray(readProperty(options, 'attendees')).flatMap((node) => {
        const role = roleOf(node, node)
        return role === undefined ? [] : [role.id]
      })
      const agenda = readArray(readProperty(options, 'agenda')).flatMap((node) => {
        const resolved = placeOf(node, node)
        return resolved === undefined ? [] : [resolved]
      })
      const decisions = readArray(readProperty(options, 'decisions')).flatMap((node) => {
        const decision = callOf(node, 'decide')
        const resolved = decision === undefined ? undefined : placeOf(decision.arguments[0], node)
        const text = decision === undefined ? undefined : readString(decision.arguments[1])
        return resolved === undefined || text === undefined ? [] : [{ place: resolved, text }]
      })

      const questionIds: string[] = []
      const questionsNode = readProperty(options, 'questions')
      if (questionsNode !== undefined && ts.isObjectLiteralExpression(questionsNode)) {
        for (const property of questionsNode.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
            continue
          }
          const key = property.name.text
          const questionPlace = { file, line: lineOf(parsed, property) }
          const unknown = findUnknownTokens(key)
          if (unknown.length > 0) {
            problems.push({ ...questionPlace, rule: 'question-name', message: `課題の名前「${key}」の単語「${unknown.join('・')}」が単語帳にない` })
          }
          const raised = callOf(property.initializer, 'raise')
          const option = raised?.arguments[2] === undefined ? undefined : unwrap(raised.arguments[2])
          const resolved = raised === undefined ? undefined : placeOf(raised.arguments[0], property)
          const assignee = option !== undefined && ts.isObjectLiteralExpression(option) ? roleOf(readProperty(option, 'assignee'), property) : undefined
          const deadline = option !== undefined && ts.isObjectLiteralExpression(option) ? (readString(readProperty(option, 'deadline')) ?? '') : ''
          if (!datePattern.test(deadline) || deadline < date) {
            problems.push({ ...questionPlace, rule: 'question-deadline', message: `課題「${key}」の期限「${deadline}」は YYYY-MM-DD にし、打合せの日以後にする` })
          }
          const text = raised === undefined ? undefined : readString(raised.arguments[1])
          if (resolved === undefined || assignee === undefined || text === undefined) {
            continue
          }
          const question: QuestionNode = {
            id: `${variable}.${key}`,
            key,
            meetingId: variable,
            date,
            place: resolved,
            text,
            assigneeId: assignee.id,
            deadline,
            answer: null,
            ...questionPlace,
          }
          questions.push(question)
          questionIds.push(question.id)
          questionByKey.set(`${file}#${variable}.${key}`, question)
        }
      }

      const answers: { questionId: string; text: string }[] = []
      for (const node of readArray(readProperty(options, 'answers'))) {
        const answered = callOf(node, 'answer')
        const target = answered?.arguments[0] === undefined ? undefined : unwrap(answered.arguments[0])
        // meeting20261003.questions.overpaymentHandling の形だけを読む。
        const meetingNode = target !== undefined && ts.isPropertyAccessExpression(target) && ts.isPropertyAccessExpression(target.expression) ? target.expression.expression : undefined
        const meetingKey = placeKeyOf(parsed, meetingNode)
        const text = answered === undefined ? undefined : readString(answered.arguments[1])
        if (meetingKey === undefined || target === undefined || !ts.isPropertyAccessExpression(target) || text === undefined) {
          problems.push({ file, line: lineOf(parsed, node), rule: 'answer', message: '回答は answer(meeting20261003.questions.課題の名前, 回答) の形で書く' })
          continue
        }
        pendingAnswers.push({ questionKey: `${meetingKey}.${target.name.text}`, meetingId: variable, date, text, file, line: lineOf(parsed, node) })
        answers.push({ questionId: `${meetingKey.split('#')[1] ?? ''}.${target.name.text}`, text })
      }

      const approvalNode = readProperty(options, 'approval')
      const approval =
        approvalNode !== undefined && ts.isObjectLiteralExpression(approvalNode)
          ? (() => {
              const on = readString(readProperty(approvalNode, 'on')) ?? ''
              const by = roleOf(readProperty(approvalNode, 'by'), approvalNode)
              if (!datePattern.test(on) || on < date) {
                problems.push({ file, line: lineOf(parsed, approvalNode), rule: 'approval', message: `承認の日「${on}」は YYYY-MM-DD にし、打合せの日以後にする` })
              }
              if (by !== undefined && by.side !== 'business') {
                problems.push({ file, line: lineOf(parsed, approvalNode), rule: 'approval', message: '議事録を承認するのは、業務部門の役割にする' })
              }
              return by === undefined ? null : { on, byId: by.id }
            })()
          : null

      meetings.push({
        id: variable,
        date,
        title: readString(readProperty(options, 'title')) ?? variable,
        attendeeIds,
        agenda,
        decisions,
        questionIds,
        answers,
        approval,
        ...place,
      })
    }
  }

  // 回答を課題につなぐ。回答は、課題を挙げた打合せより後の打合せで、1回だけ。
  const answeredQuestions = new Map<string, QuestionNode>()
  for (const pending of pendingAnswers.sort((left, right) => left.date.localeCompare(right.date))) {
    const question = questionByKey.get(pending.questionKey)
    if (question === undefined) {
      problems.push({ file: pending.file, line: pending.line, rule: 'answer', message: `回答する課題「${pending.questionKey.split('#')[1] ?? ''}」がない` })
      continue
    }
    if (pending.date <= question.date) {
      problems.push({ file: pending.file, line: pending.line, rule: 'answer', message: `課題「${question.id}」には、挙げた打合せより後の打合せで回答する` })
      continue
    }
    if (answeredQuestions.has(question.id)) {
      problems.push({ file: pending.file, line: pending.line, rule: 'answer', message: `課題「${question.id}」には、もう回答している` })
      continue
    }
    answeredQuestions.set(question.id, { ...question, answer: { meetingId: pending.meetingId, date: pending.date, text: pending.text } })
  }
  return {
    meetings: meetings.sort((left, right) => left.date.localeCompare(right.date)),
    questions: questions.map((question) => answeredQuestions.get(question.id) ?? question).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id)),
  }
}
