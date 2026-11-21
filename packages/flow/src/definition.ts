// 業務フローとシナリオの書き方。コーバーンのユースケースの目的のレベルに合わせる。
// 業務フロー（要約）は段の並び、シナリオ（利用者の目的）は1人が1回の操作で目的を果たす手順、
// usecase（下位機能）はバックエンドの処理。中身を書いていないシナリオ・拡張は「未着手」として扱う。
import type { LegacyFlow, LegacyStep, Replacement } from './legacy'
import type { Role } from './role'
import type { Screen } from './screen'

/** 画面を操作する手順。input はフローやケースから渡す値。 */
export type ScenarioStep<Input> = (screen: Screen, input: Input) => Promise<void>

/** シナリオの拡張（うまくいかない条件と、そのときの扱い）。confirm がなければ扱いは未着手。 */
export type ScenarioExtension<Input> = {
  /** 条件（日本語）。「振込依頼人名から顧客を特定できない」のように、何が起きたかを書く。 */
  readonly condition: string
  /** その条件のときに確かめること（扱い）。 */
  readonly confirm?: ScenarioStep<Input>
}

export type Scenario<Input = undefined, ExtensionName extends string = string> = {
  readonly kind: 'scenario'
  /** 動詞で始まる名前（単語帳の言葉）。変数の名前と同じにする。 */
  readonly name: string
  /** 主アクター（defineRole で書いた役割）。 */
  readonly actor: Role
  /** 主成功シナリオの手順。なければ未着手。 */
  readonly operate: ScenarioStep<Input> | undefined
  /** 成功の保証（うまくいったときに確かめること）。 */
  readonly confirm: ScenarioStep<Input> | undefined
  readonly extensions: Readonly<Record<ExtensionName, ScenarioExtension<Input>>>
}

type ScenarioDefinition<Input, ExtensionName extends string> = {
  readonly actor: Role
  readonly operate?: ScenarioStep<Input>
  readonly confirm?: ScenarioStep<Input>
  readonly extensions?: Readonly<Record<ExtensionName, ScenarioExtension<Input>>>
}

/** シナリオを書く。手順（operate）を書くまでは未着手。 */
export function defineScenario<Input = undefined, ExtensionName extends string = never>(
  name: string,
  definition: ScenarioDefinition<Input, ExtensionName>,
): Scenario<Input, ExtensionName> {
  return {
    kind: 'scenario',
    name,
    actor: definition.actor,
    operate: definition.operate,
    confirm: definition.confirm,
    extensions: definition.extensions ?? ({} as Record<ExtensionName, ScenarioExtension<Input>>),
  }
}

/** フローの中で、ある段の拡張の条件が起きたときの流れ。拡張の段のあと、本線の次の段へ戻る。 */
export type FlowExtension = {
  readonly name: string
  readonly condition: string
  readonly scenario: Scenario<unknown, string>
  readonly input: unknown
  readonly then: readonly FlowStep[]
  /** false なら、拡張の段のあと本線に戻らず、経路を終える（後の段の値が合わなくなるとき）。 */
  readonly resume: boolean
}

/** 段: 画面の操作（シナリオ）。 */
export type OperateStep = {
  readonly kind: 'operate'
  readonly scenario: Scenario<unknown, string>
  readonly input: unknown
  readonly extensions: readonly FlowExtension[]
}
/** 段: システムの外の業務。新しい業務フローでは、apps/web/step に書いた値を使う。 */
export type OutsideStep = { readonly kind: 'outside'; readonly actor: Role; readonly name: string; readonly replacement?: undefined }
/** 段: 外のイベント。新しい業務フローでは、apps/web/step に書いた値を使う。 */
export type OccurStep = { readonly kind: 'occur'; readonly actor: Role; readonly name: string; readonly replacement?: undefined }
/** 段: 時の経過。 */
export type ElapseStep = { readonly kind: 'elapse'; readonly time: string; readonly date: string }
/** 段: 子フロー。 */
export type NestStep = { readonly kind: 'nest'; readonly flow: Flow<unknown> }

export type FlowStep = OperateStep | OutsideStep | OccurStep | ElapseStep | NestStep

/** 事前条件。summary は日本語の説明、seed はテストで最初に入れておくデータ。 */
export type FlowPrecondition<Seed> = { readonly summary: string; readonly seed: Seed }

export type Flow<Seed = unknown> = {
  readonly kind: 'flow'
  /** 名詞句の名前（単語帳の言葉）。変数の名前と同じにする。 */
  readonly name: string
  readonly precondition: FlowPrecondition<Seed> | undefined
  readonly steps: readonly FlowStep[]
}

/** 業務フローを書く。 */
export function defineFlow<Seed = unknown>(
  name: string,
  definition: { readonly precondition?: FlowPrecondition<Seed>; readonly steps: readonly FlowStep[] },
): Flow<Seed> {
  return { kind: 'flow', name, precondition: definition.precondition, steps: definition.steps }
}

/** 拡張の条件が起きたときの値と、そのあとの段。 */
export type ExtensionFlow<Input> = { readonly input: Input; readonly then?: readonly FlowStep[]; readonly resume?: boolean }

type OperateRest<Input, ExtensionName extends string> = [Input] extends [undefined]
  ? []
  : [input: Input, extensions?: Readonly<Partial<Record<ExtensionName, ExtensionFlow<Input>>>>]

/** 段: 画面の操作（シナリオ）。未着手のシナリオには値を渡さない。手順を書くと、値が要るようになる。 */
export function operate<Input, ExtensionName extends string>(
  scenario: Scenario<Input, ExtensionName>,
  ...rest: OperateRest<Input, ExtensionName>
): OperateStep {
  const [input, extensions = {}] = rest as [unknown, Readonly<Partial<Record<string, ExtensionFlow<unknown>>>>?]
  const extensionList = Object.entries(extensions as Readonly<Record<string, ExtensionFlow<unknown>>>).map(([name, extension]) => ({
    name,
    condition: (scenario.extensions as Readonly<Record<string, ScenarioExtension<unknown>>>)[name]?.condition ?? name,
    scenario: scenario as Scenario<unknown, string>,
    input: extension.input,
    then: extension.then ?? [],
    resume: extension.resume ?? true,
  }))
  return { kind: 'operate', scenario: scenario as Scenario<unknown, string>, input, extensions: extensionList }
}

/** 置き換え先を1つでも、いくつでも受け取る。 */
export function listReplacements(replacement: Replacement | readonly Replacement[] | undefined): readonly Replacement[] {
  return replacement === undefined ? [] : Array.isArray(replacement) ? replacement : [replacement as Replacement]
}

/** 置き換え先の指定（現行の業務フローで、変わる段にだけ書く）。 */
export type ReplacementOption = { readonly replacement: Replacement | readonly Replacement[] }

/**
 * 段: システムの外の業務（商品を納品する・請求書を送るなど）。name は動詞で始まる名前。
 * 現行の業務フローで変わる段は、replacement に新しい業務フローの置き換え先を書く。
 */
export function outside(actor: Role, name: string): OutsideStep
export function outside(actor: Role, name: string, option: ReplacementOption): LegacyStep
export function outside(actor: Role, name: string, option?: ReplacementOption): OutsideStep | LegacyStep {
  return option === undefined ? { kind: 'outside', actor, name } : { kind: 'outside', actor, name, replacement: listReplacements(option.replacement) }
}

/** 段: 外のイベント（代金が振り込まれるなど）。name は動詞で始まる名前。現行の業務フローで変わる段は replacement を書く。 */
export function occur(actor: Role, name: string): OccurStep
export function occur(actor: Role, name: string, option: ReplacementOption): LegacyStep
export function occur(actor: Role, name: string, option?: ReplacementOption): OccurStep | LegacyStep {
  return option === undefined ? { kind: 'occur', actor, name } : { kind: 'occur', actor, name, replacement: listReplacements(option.replacement) }
}

/** 段: 時の経過（締め日になる）。テストでは今日の日付を date にする。現行の業務フローは動かさないので、日付を書かない。 */
export function elapse(time: string, date: string): ElapseStep
export function elapse(time: string): LegacyStep
export function elapse(time: string, date?: string): ElapseStep | LegacyStep {
  return date === undefined ? { kind: 'elapse', time, date: undefined } : { kind: 'elapse', time, date }
}

/** 段: 子フロー。現行の業務フローの中では、現行の業務フローを入れる。 */
export function nest(flow: Flow<unknown>): NestStep
export function nest(flow: LegacyFlow): LegacyStep
export function nest(flow: Flow<unknown> | LegacyFlow): NestStep | LegacyStep {
  return flow.kind === 'flow' ? { kind: 'nest', flow } : { kind: 'nest', flow }
}

/** シナリオの手順を流す（ケースから使う）。未着手なら止める。 */
export async function operateScenario<Input>(scenario: Scenario<Input, string>, screen: Screen, input: Input): Promise<void> {
  if (scenario.operate === undefined) {
    throw new Error(`シナリオ「${scenario.name}」の手順は未着手です。`)
  }
  await scenario.operate(screen, input)
}

/** シナリオの成功の保証を確かめる（ケースから使う）。 */
export async function confirmScenario<Input>(scenario: Scenario<Input, string>, screen: Screen, input: Input): Promise<void> {
  if (scenario.confirm === undefined) {
    throw new Error(`シナリオ「${scenario.name}」の成功の保証は未着手です。`)
  }
  await scenario.confirm(screen, input)
}

/** 拡張の扱いを確かめる（ケースから使う）。 */
export async function confirmExtension<Input, ExtensionName extends string>(
  scenario: Scenario<Input, ExtensionName>,
  extension: ExtensionName,
  screen: Screen,
  input: Input,
): Promise<void> {
  const confirm = scenario.extensions[extension].confirm
  if (confirm === undefined) {
    throw new Error(`拡張「${scenario.extensions[extension].condition}」の扱いは未着手です。`)
  }
  await confirm(screen, input)
}
