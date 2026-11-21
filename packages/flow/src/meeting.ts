// 議事録の書き方。打合せで話したことは、決めたこと（decide）か課題（raise）のどちらかにする。
// どちらも、話している業務フロー・シナリオ・拡張・画面・処理などを値で持つので、名前を変えたり消したりすると型エラーになり、宙に浮かない。
// 課題が解決したかどうかは持たない。後の打合せで、その課題を指して決めたこと（decide の question）から求める。
import type { Flow, Scenario } from './definition'
import type { Role } from './role'

/** 議事録から指すシナリオ（場所を指すだけなので、種類と名前だけを見る）。 */
export type ScenarioPlace = Pick<Scenario, 'kind' | 'name'>

/** 拡張を、議事録から参照するための値。 */
export type ExtensionPlace = { readonly kind: 'extension'; readonly scenario: ScenarioPlace; readonly name: string }

/** 関数で書いたもの（画面の部品・処理・規則など）。 */
export type CodePlace = (...parameters: never[]) => unknown

/**
 * 議事録の項目が話している場所。業務フロー（大きい粒度）・シナリオ・拡張（細かい粒度）か、
 * 画面の部品・処理・規則などの関数。
 */
export type MeetingPlace = Flow<unknown> | ScenarioPlace | ExtensionPlace | CodePlace

export type Question = {
  readonly kind: 'question'
  readonly places: readonly MeetingPlace[]
  readonly text: string
  /** 答える役割。 */
  readonly assignee: Role
  /** 答える期限（YYYY-MM-DD）。 */
  readonly deadline: string
}

export type Decision = {
  readonly kind: 'decision'
  readonly places: readonly MeetingPlace[]
  readonly text: string
  /** この決定で解決する、前の打合せの課題。 */
  readonly question: Question | undefined
}

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
}

type MeetingDefinition<QuestionName extends string> = {
  readonly title: string
  readonly attendees: readonly Role[]
  readonly agenda: readonly MeetingPlace[]
  readonly decisions?: readonly Decision[]
  readonly questions?: Readonly<Record<QuestionName, Question>>
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
  }
}

/** 拡張を参照する。拡張の名前はシナリオの extensions のキー（型で検査する）。 */
export function extensionOf<Input, ExtensionName extends string>(scenario: Scenario<Input, ExtensionName>, name: ExtensionName): ExtensionPlace {
  return { kind: 'extension', scenario, name }
}

function listPlaces(place: MeetingPlace | readonly MeetingPlace[]): readonly MeetingPlace[] {
  return Array.isArray(place) ? place : [place as MeetingPlace]
}

/** 決めたこと。前の打合せの課題を解決するなら、question にその課題を渡す。 */
export function decide(place: MeetingPlace | readonly MeetingPlace[], text: string, option: { readonly question?: Question } = {}): Decision {
  return { kind: 'decision', places: listPlaces(place), text, question: option.question }
}

/** 課題を挙げる。答える役割と期限を決める。 */
export function raise(place: MeetingPlace | readonly MeetingPlace[], text: string, option: { readonly assignee: Role; readonly deadline: string }): Question {
  return { kind: 'question', places: listPlaces(place), text, assignee: option.assignee, deadline: option.deadline }
}
