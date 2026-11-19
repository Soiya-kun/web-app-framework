// シナリオが画面を操作する言い方。利用者と同じく、ラベル・ボタン・見出しの名前（単語帳のキー）で画面の要素を指す。
// 実装は、インプロセスのテスト（Testing Library）と、実ブラウザ（Playwright）で差し替えられる。
import type { ActionKey, LabelKey, MessageKey, MessageParams } from '@app/vocabulary/text'

/** 表のセルの値。数は金額として、画面の円の表示と比べる。 */
export type CellValue = string | number

/** 表の1行目の、列の見出しごとの値。 */
export type CellExpectation = Readonly<Partial<Record<LabelKey, CellValue>>>

export interface Screen {
  /** 画面の上のナビゲーションから、画面を開く。 */
  go(page: LabelKey): Promise<void>
  /** 画面の中のリンクをたどる（表の請求締め日など）。 */
  follow(linkText: string): Promise<void>
  /** 入力欄に値を入れる（前の値は消す）。空なら消すだけ。 */
  fill(field: LabelKey, value: string): Promise<void>
  /** 選択肢を、表示の名前で選ぶ。空なら「選んでください」に戻す。 */
  choose(field: LabelKey, option: string): Promise<void>
  /** ボタンを押す。 */
  press(button: ActionKey | LabelKey): Promise<void>
  /** 表の、指定した文字をすべて含む1つの行の中だけを操作する。 */
  row(...rowTexts: readonly string[]): Screen
  /** 知らせ（role=status）に文が出ている。 */
  expectMessage(message: MessageKey, params?: MessageParams): Promise<void>
  /** 警告（role=alert）に文が出ている。 */
  expectAlert(message: MessageKey, params?: MessageParams): Promise<void>
  /** 入力欄の下に、その項目の問題の文が出ている（{field} は項目の名前で埋める）。 */
  expectProblem(field: LabelKey, message: MessageKey, params?: MessageParams): Promise<void>
  /** 見出しが出ている（その画面に移った）。 */
  expectHeading(heading: LabelKey): Promise<void>
  /** 表の1行目の、列ごとの値。 */
  expectCells(table: LabelKey, cells: CellExpectation): Promise<void>
  /** 表の全ての行（見出しの行を除く）。 */
  expectRows(table: LabelKey, rows: readonly (readonly CellValue[])[]): Promise<void>
  /** 文字が出ている。 */
  expectText(text: string): Promise<void>
  /** ボタンが出ていない。 */
  expectNoButton(button: ActionKey | LabelKey): Promise<void>
  /** 選択肢の並び（表示の名前）。 */
  expectOptions(field: LabelKey, options: readonly string[]): Promise<void>
}
