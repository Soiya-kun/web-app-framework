// 現行（AsIs）の業務フローと、旧システムのテーブルの書き方。現行の業務は実装しないので、画面の操作の手順・処理は書かない。
// どの新しい業務フロー（ToBe）に置き換わるかを値で指すので、新しい業務フローやシナリオの名前を変えたり消したりすると型エラーになる。
// システムの外の業務が変わらない段は、新しい業務フローと同じ値（apps/web/step）を使う。変わる段には、置き換え先を書く。
import type { Flow, OccurStep, OutsideStep } from './definition'
import { listReplacements } from './definition'
import type { ScenarioPlace } from './meeting'
import type { Role } from './role'

/** 置き換え先。新しい業務フローのシナリオ・システムの外の業務（apps/web/step の値）・業務フロー。 */
export type Replacement = ScenarioPlace | OutsideStep | OccurStep | Flow<unknown>

/** 旧システムのテーブルの列。 */
export type LegacyColumn = {
  /** 旧システムでの列の名前（物理名）。 */
  readonly name: string
  /** 列の意味（日本語）。 */
  readonly title: string
  readonly type?: string
  readonly note?: string
  /** 移す先の新しいテーブルの列（「テーブル.列」）。マイグレーションにあるかを検査で確かめる。 */
  readonly replacement?: string
}

/** 旧システムのテーブル。新しいシステムの設計を、旧システムの構造を前提に考えるときに見る。 */
export type LegacyTable = {
  readonly kind: 'legacyTable'
  /** 旧システムでのテーブルの名前（物理名）。 */
  readonly name: string
  readonly title: string
  readonly note: string | undefined
  readonly columns: readonly LegacyColumn[]
}

/**
 * 旧システムの画面の操作。記録するだけで動かさない（スタブの E2E のように、手順の形で残す）。
 * 画面・項目・ボタンの名前は、旧システムの画面の文言をそのまま書く。
 */
export type LegacyScreen = {
  /** メニューから画面を開く。 */
  go(menu: string): Promise<void>
  follow(link: string): Promise<void>
  fill(field: string, value: string): Promise<void>
  choose(field: string, choice: string): Promise<void>
  press(button: string): Promise<void>
  expectText(text: string): Promise<void>
}

/** 旧システムの画面の手順。画面の操作（await screen.…）を並べるだけにする。 */
export type LegacyScreenStep = (screen: LegacyScreen) => Promise<void>

/** 現行の業務フローの段。 */
export type LegacyStep =
  | OutsideStep
  | OccurStep
  /** 新しい業務フローで変わる、システムの外の業務・外のイベント。 */
  | { readonly kind: 'outside' | 'occur'; readonly actor: Role; readonly name: string; readonly replacement: readonly Replacement[] }
  | { readonly kind: 'elapse'; readonly time: string; readonly date: undefined }
  /** 旧システムの操作。 */
  | {
      readonly kind: 'legacy'
      readonly actor: Role
      readonly name: string
      readonly tables: readonly LegacyTable[]
      readonly replacement: readonly Replacement[]
      /** 旧システムの画面の手順と、そのあと画面で確かめること（書かなくてもよい）。 */
      readonly operate: LegacyScreenStep | undefined
      readonly confirm: LegacyScreenStep | undefined
    }
  | { readonly kind: 'nest'; readonly flow: LegacyFlow }

export type LegacyFlow = {
  readonly kind: 'legacyFlow'
  /** 名詞句の名前（legacy で始める単語帳の言葉）。変数の名前と同じにする。 */
  readonly name: string
  /** 置き換え先の新しい業務フロー。なければ、この業務はなくなる。 */
  readonly replacement: readonly Flow<unknown>[]
  readonly steps: readonly LegacyStep[]
}

/** 現行の業務フローを書く。 */
export function defineLegacyFlow(
  name: string,
  definition: { readonly replacement?: Flow<unknown> | readonly Flow<unknown>[]; readonly steps: readonly LegacyStep[] },
): LegacyFlow {
  const replacement = definition.replacement === undefined ? [] : Array.isArray(definition.replacement) ? definition.replacement : [definition.replacement as Flow<unknown>]
  return { kind: 'legacyFlow', name, replacement, steps: definition.steps }
}

/** 段: 旧システムの操作。使うテーブル・新しい業務フローの置き換え先と、残したければ旧システムの画面の手順を書く。 */
export function operateLegacy(
  actor: Role,
  name: string,
  option: {
    readonly tables?: readonly LegacyTable[]
    readonly replacement?: Replacement | readonly Replacement[]
    readonly operate?: LegacyScreenStep
    readonly confirm?: LegacyScreenStep
  } = {},
): LegacyStep {
  return {
    kind: 'legacy',
    actor,
    name,
    tables: option.tables ?? [],
    replacement: listReplacements(option.replacement),
    operate: option.operate,
    confirm: option.confirm,
  }
}

/** 旧システムのテーブルを書く。 */
export function defineLegacyTable(
  name: string,
  definition: { readonly title: string; readonly note?: string; readonly columns: readonly LegacyColumn[] },
): LegacyTable {
  return { kind: 'legacyTable', name, title: definition.title, note: definition.note, columns: definition.columns }
}
