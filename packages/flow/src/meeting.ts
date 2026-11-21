// 議事録の書き方。打合せで決めたこと・挙がった課題・課題への回答を、業務フロー・シナリオ・拡張を参照して書く。
// 参照は値で持つので、業務フローやシナリオを消したり名前を変えたりすると型エラーになり、課題が宙に浮かない。
// 課題が解決したかどうかは持たない。後の打合せの回答（answer）から求める。
import type { Flow, Scenario } from './definition'
import type { Role } from './role'

/** 議事録から指すシナリオ（場所を指すだけなので、種類と名前だけを見る）。 */
export type ScenarioPlace = Pick<Scenario, 'kind' | 'name'>

/** 拡張を、議事録から参照するための値。 */
export type ExtensionPlace = { readonly kind: 'extension'; readonly scenario: ScenarioPlace; readonly name: string }

/** 議事録の項目が話している場所。業務フロー（大きい粒度）・シナリオ・拡張（細かい粒度）のどれか。 */
export type MeetingPlace = Flow<unknown> | ScenarioPlace | ExtensionPlace

export type Decision = { readonly kind: 'decision'; readonly place: MeetingPlace; readonly text: string }

export type Question = {
  readonly kind: 'question'
  readonly place: MeetingPlace
  readonly text: string
  /** 答える役割。 */
  readonly assignee: Role
  /** 答える期限（YYYY-MM-DD）。 */
  readonly deadline: string
}

export type Answer = { readonly kind: 'answer'; readonly question: Question; readonly text: string }

/** 先方の承認（先方が議事録を確かめた日と、確かめた役割）。開発チームが記録する。 */
export type Approval = { readonly on: string; readonly by: Role }

export type Meeting<QuestionName extends string = string> = {
  readonly kind: 'meeting'
  /** 打合せの日（YYYY-MM-DD）。 */
  readonly date: string
  readonly title: string
  readonly attendees: readonly Role[]
  /** 議題の業務フロー・シナリオ。 */
  readonly agenda: readonly MeetingPlace[]
  readonly decisions: readonly Decision[]
  /** この回で挙がった課題。名前（単語帳の言葉）で、後の回から参照する。 */
  readonly questions: Readonly<Record<QuestionName, Question>>
  /** 前の回までの課題への回答。 */
  readonly answers: readonly Answer[]
  /** 先方の承認。まだなら undefined（未承認）。 */
  readonly approval: Approval | undefined
}

type MeetingDefinition<QuestionName extends string> = {
  readonly title: string
  readonly attendees: readonly Role[]
  readonly agenda: readonly MeetingPlace[]
  readonly decisions?: readonly Decision[]
  readonly questions?: Readonly<Record<QuestionName, Question>>
  readonly answers?: readonly Answer[]
  readonly approval?: Approval
}

/** 議事録を書く。変数の名前は meeting と日付（meeting20261003）にする。 */
export function defineMeeting<QuestionName extends string = never>(date: string, definition: MeetingDefinition<QuestionName>): Meeting<QuestionName> {
  return {
    kind: 'meeting',
    date,
    title: definition.title,
    attendees: definition.attendees,
    agenda: definition.agenda,
    decisions: definition.decisions ?? [],
    questions: definition.questions ?? ({} as Record<QuestionName, Question>),
    answers: definition.answers ?? [],
    approval: definition.approval,
  }
}

/** 拡張を参照する。拡張の名前はシナリオの extensions のキー（型で検査する）。 */
export function extensionOf<Input, ExtensionName extends string>(scenario: Scenario<Input, ExtensionName>, name: ExtensionName): ExtensionPlace {
  return { kind: 'extension', scenario, name }
}

/** 決めたこと。 */
export function decide(place: MeetingPlace, text: string): Decision {
  return { kind: 'decision', place, text }
}

/** 課題を挙げる。答える役割と期限を決める。 */
export function raise(place: MeetingPlace, text: string, option: { readonly assignee: Role; readonly deadline: string }): Question {
  return { kind: 'question', place, text, assignee: option.assignee, deadline: option.deadline }
}

/** 前の回の課題に答える。 */
export function answer(question: Question, text: string): Answer {
  return { kind: 'answer', question, text }
}
