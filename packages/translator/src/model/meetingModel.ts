// 議事録（apps/web/meeting の defineMeeting）を読む。決めたこと・課題を、指している業務フロー・シナリオ・拡張・画面・処理・現行の業務フローと役割につなぐ。
// 課題が解決したかどうかは議事録に書かない。後の打合せで、その課題を指して決めたこと（decide の question）をたどって求める。
import { findUnknownTokens } from '@app/vocabulary'
import ts from 'typescript'
import type { ScenarioDraft } from './flowModel'
import { lineOf, listExportedCalls, readProperty, readString, unwrap, type ParsedSource, type SourceReader } from './source'
import type { DecisionNode, FlowNode, LegacyFlowNode, LegacyTableNode, MeetingNode, MeetingPlaceNode, ModelProblem, PageNode, QuestionNode, RoleNode, RuleNode, WorkNode } from './types'

export const meetingRoot = 'apps/web/meeting'

export type MeetingModel = {
  readonly meetings: MeetingNode[]
  readonly questions: QuestionNode[]
}

/** 議事録・見積から指せるもの。キーは「定義したファイル#名前」。 */
export type PlaceTables = {
  readonly roles: ReadonlyMap<string, RoleNode>
  readonly flows: ReadonlyMap<string, FlowNode>
  readonly scenarios: ReadonlyMap<string, ScenarioDraft>
  readonly pages: ReadonlyMap<string, PageNode>
  readonly works: ReadonlyMap<string, WorkNode>
  readonly rules: ReadonlyMap<string, RuleNode>
  readonly legacyFlows: ReadonlyMap<string, LegacyFlowNode>
  readonly legacyTables: ReadonlyMap<string, LegacyTableNode>
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/

/** 名前（識別子）が指す、import した定義の場所（ファイル#名前）。同じファイルの定義なら、そのファイル。 */
function placeKeyOf(parsed: ParsedSource, node: ts.Expression | undefined): string | undefined {
  const inner = node === undefined ? undefined : unwrap(node)
  if (inner === undefined || !ts.isIdentifier(inner)) {
    return undefined
  }
  const imported = parsed.imports.get(inner.text)
  if (imported === undefined) {
    return `${parsed.file}#${inner.text}`
  }
  // パッケージの名前で import したもの（@app/flow など）は、どのファイルの定義か分からない。
  return imported.file === null ? undefined : `${imported.file}#${imported.name}`
}

/** 議事録・見積の項目が指している場所（業務フロー・シナリオ・拡張・画面・処理・規則・現行の業務フロー・そのほかの関数）。 */
export function readPlace(parsed: ParsedSource, node: ts.Expression, tables: PlaceTables): MeetingPlaceNode | undefined {
  const inner = unwrap(node)
  if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === 'extensionOf') {
    const scenario = tables.scenarios.get(placeKeyOf(parsed, inner.arguments[0]) ?? '')
    const extension = readString(inner.arguments[1])
    const condition = scenario?.extensions.find((candidate) => candidate.name === extension)?.condition
    return scenario === undefined || extension === undefined || condition === undefined
      ? undefined
      : { kind: 'extension', id: scenario.id, extension, title: `${scenario.title} › ${condition}` }
  }
  const key = placeKeyOf(parsed, inner)
  if (key === undefined || !ts.isIdentifier(inner) || !parsed.imports.has(inner.text)) {
    return undefined
  }
  const flow = tables.flows.get(key)
  if (flow !== undefined) {
    return { kind: 'flow', id: flow.id, extension: null, title: flow.title }
  }
  const scenario = tables.scenarios.get(key)
  if (scenario !== undefined) {
    return { kind: 'scenario', id: scenario.id, extension: null, title: scenario.title }
  }
  const page = tables.pages.get(key)
  if (page !== undefined) {
    return { kind: 'page', id: page.id, extension: null, title: page.title }
  }
  const work = tables.works.get(key)
  if (work !== undefined) {
    return { kind: 'work', id: work.id, extension: null, title: work.title }
  }
  const rule = tables.rules.get(key)
  if (rule !== undefined) {
    return { kind: 'rule', id: rule.id, extension: null, title: rule.title }
  }
  const legacyFlow = tables.legacyFlows.get(key)
  if (legacyFlow !== undefined) {
    return { kind: 'legacy', id: legacyFlow.id, extension: null, title: legacyFlow.title }
  }
  const legacyTable = tables.legacyTables.get(key)
  if (legacyTable !== undefined) {
    return { kind: 'legacyTable', id: legacyTable.id, extension: null, title: legacyTable.title }
  }
  // そのほかの関数（画面の部品など）は、名前とファイルで出す。
  return { kind: 'source', id: key, extension: null, title: inner.text }
}

function readArray(node: ts.Expression | undefined): readonly ts.Expression[] {
  const inner = node === undefined ? undefined : unwrap(node)
  return inner !== undefined && ts.isArrayLiteralExpression(inner) ? inner.elements : []
}

function callOf(node: ts.Expression, calleeName: string): ts.CallExpression | undefined {
  const inner = unwrap(node)
  return ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === calleeName ? inner : undefined
}

export function readMeetingModel(reader: SourceReader, tables: PlaceTables, problems: ModelProblem[]): MeetingModel {
  const meetings: MeetingNode[] = []
  const questions: QuestionNode[] = []
  const pendingDecisions: { readonly questionKey: string; readonly meetingId: string; readonly date: string; readonly text: string; readonly file: string; readonly line: number }[] = []
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
        problems.push({ ...place, rule: 'meeting', message: '議事録の2つめの引数は { title, attendees, agenda, decisions, questions } にする' })
        continue
      }
      /** 場所を1つ、または配列で書いたものを読む。 */
      const placesOf = (node: ts.Expression | undefined, at: ts.Node): MeetingPlaceNode[] => {
        const inner = node === undefined ? undefined : unwrap(node)
        const nodes = inner !== undefined && ts.isArrayLiteralExpression(inner) ? inner.elements : inner === undefined ? [] : [inner]
        const resolved = nodes.flatMap((element) => {
          const target = readPlace(parsed, element, tables)
          return target === undefined ? [] : [target]
        })
        if (nodes.length === 0 || resolved.length !== nodes.length) {
          problems.push({
            file,
            line: lineOf(parsed, at),
            rule: 'meeting-place',
            message: '議事録の項目は、業務フロー・シナリオ・extensionOf(シナリオ, 拡張)・画面の部品・処理などを、ファイルから import して指す',
          })
        }
        return resolved
      }
      const roleOf = (node: ts.Expression | undefined, at: ts.Node): RoleNode | undefined => {
        const role = tables.roles.get(placeKeyOf(parsed, node) ?? '')
        if (role === undefined) {
          problems.push({ file, line: lineOf(parsed, at), rule: 'meeting-role', message: '出席者・課題の担当者は、apps/web/role の defineRole の役割を import して渡す' })
        }
        return role
      }

      const attendeeIds = readArray(readProperty(options, 'attendees')).flatMap((node) => {
        const role = roleOf(node, node)
        return role === undefined ? [] : [role.id]
      })
      const agenda = readArray(readProperty(options, 'agenda')).flatMap((node) => placesOf(node, node))

      const decisions: DecisionNode[] = []
      for (const node of readArray(readProperty(options, 'decisions'))) {
        const decision = callOf(node, 'decide')
        const text = decision === undefined ? undefined : readString(decision.arguments[1])
        if (decision === undefined || text === undefined) {
          problems.push({ file, line: lineOf(parsed, node), rule: 'meeting-place', message: '決めたことは decide(場所, 決めたこと, { question }) の形で書く' })
          continue
        }
        const places = placesOf(decision.arguments[0], node)
        const option = decision.arguments[2] === undefined ? undefined : unwrap(decision.arguments[2])
        const questionNode = option !== undefined && ts.isObjectLiteralExpression(option) ? readProperty(option, 'question') : undefined
        let questionId: string | null = null
        if (questionNode !== undefined) {
          // meeting20261003.questions.overpaymentHandling の形だけを読む。
          const target = unwrap(questionNode)
          const meetingNode = ts.isPropertyAccessExpression(target) && ts.isPropertyAccessExpression(target.expression) ? target.expression.expression : undefined
          const meetingKey = placeKeyOf(parsed, meetingNode)
          if (meetingKey === undefined || !ts.isPropertyAccessExpression(target)) {
            problems.push({ file, line: lineOf(parsed, node), rule: 'decision-question', message: '解決する課題は { question: meeting20261003.questions.課題の名前 } の形で書く' })
          } else {
            pendingDecisions.push({ questionKey: `${meetingKey}.${target.name.text}`, meetingId: variable, date, text, file, line: lineOf(parsed, node) })
            questionId = `${meetingKey.split('#')[1] ?? ''}.${target.name.text}`
          }
        }
        decisions.push({ places, text, questionId })
      }

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
          const places = raised === undefined ? [] : placesOf(raised.arguments[0], property)
          const assignee = option !== undefined && ts.isObjectLiteralExpression(option) ? roleOf(readProperty(option, 'assignee'), property) : undefined
          const deadline = option !== undefined && ts.isObjectLiteralExpression(option) ? (readString(readProperty(option, 'deadline')) ?? '') : ''
          if (!datePattern.test(deadline) || deadline < date) {
            problems.push({ ...questionPlace, rule: 'question-deadline', message: `課題「${key}」の期限「${deadline}」は YYYY-MM-DD にし、打合せの日以後にする` })
          }
          const text = raised === undefined ? undefined : readString(raised.arguments[1])
          if (places.length === 0 || assignee === undefined || text === undefined) {
            continue
          }
          const question: QuestionNode = {
            id: `${variable}.${key}`,
            key,
            meetingId: variable,
            date,
            places,
            text,
            assigneeId: assignee.id,
            deadline,
            decision: null,
            ...questionPlace,
          }
          questions.push(question)
          questionIds.push(question.id)
          questionByKey.set(`${file}#${variable}.${key}`, question)
        }
      }

      meetings.push({
        id: variable,
        date,
        title: readString(readProperty(options, 'title')) ?? variable,
        attendeeIds,
        agenda,
        decisions,
        questionIds,
        ...place,
      })
    }
  }

  // 決めたことを、解決する課題につなぐ。課題を挙げた打合せより後の打合せで、1回だけ。
  const resolvedQuestions = new Map<string, QuestionNode>()
  for (const pending of pendingDecisions.sort((left, right) => left.date.localeCompare(right.date))) {
    const question = questionByKey.get(pending.questionKey)
    if (question === undefined) {
      problems.push({ file: pending.file, line: pending.line, rule: 'decision-question', message: `解決する課題「${pending.questionKey.split('#')[1] ?? ''}」がない` })
      continue
    }
    if (pending.date <= question.date) {
      problems.push({ file: pending.file, line: pending.line, rule: 'decision-question', message: `課題「${question.id}」は、挙げた打合せより後の打合せで決めて解決する` })
      continue
    }
    if (resolvedQuestions.has(question.id)) {
      problems.push({ file: pending.file, line: pending.line, rule: 'decision-question', message: `課題「${question.id}」は、もう解決している` })
      continue
    }
    resolvedQuestions.set(question.id, { ...question, decision: { meetingId: pending.meetingId, date: pending.date, text: pending.text } })
  }
  return {
    meetings: meetings.sort((left, right) => left.date.localeCompare(right.date)),
    questions: questions.map((question) => resolvedQuestions.get(question.id) ?? question).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id)),
  }
}
