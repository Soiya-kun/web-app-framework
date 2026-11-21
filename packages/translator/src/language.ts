// 翻訳ツールの言語ごとの部品。見出しと手順は単語帳（概念＋語形＋文法）から作り、ここでは文の形（語順・助詞・引用符・金額）だけを言語ごとに持つ。
// 業務フロー・シナリオ・処理のモデルと、処理の仕様書は、この部品を渡して日本語と英語の両方で作る。
import { listMessages, renderNounPhrase, translateFunctionName, translateStep, type Locale } from '@app/vocabulary'
import { prepareText, type Text } from '@app/vocabulary/text'

export type Comparison = 'less' | 'greater' | 'atMost' | 'atLeast'

/** 文の形。引数は、もう訳した語句（見出し・値・手順）。 */
export type Sentence = {
  // 値
  readonly quote: (value: string) => string
  readonly slot: (label: string) => string
  readonly empty: string
  readonly amount: (amount: number) => string
  readonly list: (items: readonly string[]) => string
  readonly pairs: (items: readonly { readonly label: string; readonly value: string }[]) => string
  // 画面の操作（シナリオ・ケースの手順）
  readonly rowScope: (values: readonly string[]) => string
  readonly rowOfScope: (table: string, conditions: readonly { readonly label: string; readonly value: string }[]) => string
  readonly go: (page: string) => string
  readonly follow: (link: string) => string
  readonly fill: (field: string, value: string) => string
  readonly choose: (field: string, option: string) => string
  readonly press: (button: string) => string
  readonly expectMessage: (message: string) => string
  readonly expectAlert: (message: string) => string
  readonly expectProblem: (field: string, message: string) => string
  readonly expectHeading: (heading: string) => string
  readonly expectCells: (table: string, cells: string) => string
  readonly expectRows: (table: string) => string
  readonly expectText: (value: string) => string
  readonly expectNoButton: (button: string) => string
  readonly expectOptions: (field: string, options: string) => string
  readonly givenValues: string
  // ケースの手順
  readonly launch: (tables: readonly string[]) => string
  readonly operateWith: (scenario: string, changes: readonly string[]) => string
  readonly change: (field: string, value: string) => string
  readonly confirmGuarantee: string
  readonly confirmExtension: string
  readonly expectTable: (table: string, isEmpty: boolean) => string
  readonly expectSubject: (subject: string) => string
  // 業務フローの段
  /** 時の経過。現行の業務フローは日付を持たない（date が空）。 */
  readonly elapse: (time: string, date: string) => string
  // 処理の手順（usecase・domain）
  readonly owned: (owner: string, item: string) => string
  readonly run: (code: string) => string
  readonly isName: (noun: string, negated: boolean) => string
  readonly hasName: (noun: string, negated: boolean) => string
  readonly canName: (step: string, negated: boolean) => string
  readonly either: (left: string, right: string) => string
  readonly both: (left: string, right: string) => string
  readonly isEmpty: (noun: string, negated: boolean) => string
  readonly equals: (left: string, right: string, negated: boolean) => string
  readonly compare: (left: string, right: string, comparison: Comparison) => string
  readonly truth: (code: string, negated: boolean) => string
  readonly stopWithMessage: (message: string) => string
  readonly stopWithCode: (code: string) => string
  readonly finish: string
  readonly returnCall: (step: string) => string
  readonly returnValue: (noun: string) => string
  readonly compute: (target: string, code: string) => string
  readonly assign: (target: string, code: string) => string
  readonly when: (condition: string) => string
  readonly otherwise: string
  readonly each: (noun: string) => string
}

export type Language = {
  readonly locale: Locale
  readonly text: Text
  /** 文のキーから文（{field} などはそのまま）。 */
  readonly messages: ReadonlyMap<string, string>
  /** 名前を名詞句の見出しにする（salesAmount →「売上金額」/ "Sales Amount"）。 */
  readonly noun: (name: string) => string
  /** 文の途中に置く名詞句（英語は頭を小文字にする。ID などはそのまま。"sales amount"）。 */
  readonly phrase: (name: string) => string
  /** 呼び出しの名前を手順にする。動詞で始まらなければ undefined。 */
  readonly step: (name: string, receiverName?: string) => string | undefined
  /** 関数名を見出しにする（日本語は体言止め、英語は命令形）。 */
  readonly title: (name: string) => string
  readonly sentence: Sentence
}

const japaneseComparison: Record<Comparison, string> = {
  less: 'より小さい',
  greater: 'より大きい',
  atMost: '以下である',
  atLeast: '以上である',
}

const japanese: Sentence = {
  quote: (value) => `「${value}」`,
  slot: (label) => `〈${label}〉`,
  empty: '空',
  amount: (amount) => `${amount.toLocaleString('ja-JP')}円`,
  list: (items) => items.join('・'),
  pairs: (items) => items.map((item) => `${item.label} ${item.value}`).join('、'),
  rowScope: (values) => `${values.join('・')}の行で、`,
  rowOfScope: (table, conditions) => `「${table}」の、${conditions.map((condition) => `${condition.label}が${condition.value}`).join('・')}の行で、`,
  go: (page) => `「${page}」を開く`,
  follow: (link) => `${link}のリンクをたどる`,
  fill: (field, value) => `${field}に${value}を入れる`,
  choose: (field, option) => `${field}で${option}を選ぶ`,
  press: (button) => `「${button}」を押す`,
  expectMessage: (message) => `「${message}」と出ることを確かめる`,
  expectAlert: (message) => `警告「${message}」が出ることを確かめる`,
  expectProblem: (field, message) => `${field}に「${message}」と出ることを確かめる`,
  expectHeading: (heading) => `「${heading}」の画面になったことを確かめる`,
  expectCells: (table, cells) => `「${table}」の1行目が、${cells}であることを確かめる`,
  expectRows: (table) => `「${table}」の行を確かめる`,
  expectText: (value) => `${value}と出ることを確かめる`,
  expectNoButton: (button) => `「${button}」のボタンが出ていないことを確かめる`,
  expectOptions: (field, options) => `${field}の選択肢が${options}であることを確かめる`,
  givenValues: '（指定した値）',
  launch: (tables) => (tables.length === 0 ? '画面を開く' : `画面を開く（DB に${tables.join('・')}の行を入れておく）`),
  operateWith: (scenario, changes) => (changes.length === 0 ? scenario : `${scenario}（${changes.join('、')}にして）`),
  change: (field, value) => `${field}を${value}`,
  confirmGuarantee: '成功の保証を確かめる',
  confirmExtension: '拡張の扱いを確かめる',
  expectTable: (table, isEmpty) => `DB の${table}${isEmpty ? 'が空である' : 'の行が期待どおりである'}ことを確かめる`,
  expectSubject: (subject) => `${subject}が期待どおりであることを確かめる`,
  elapse: (time, date) => (date === '' ? `${time}になる` : `${time}になる（${date}）`),
  owned: (owner, item) => `${owner}の${item}`,
  run: (code) => `${code}を実行する`,
  isName: (noun, negated) => `${noun}${negated ? 'でない' : 'である'}`,
  hasName: (noun, negated) => `${noun}が${negated ? 'ない' : 'ある'}`,
  canName: (step, negated) => `${step}ことが${negated ? 'できない' : 'できる'}`,
  either: (left, right) => `${left}、または${right}`,
  both: (left, right) => `${left}、かつ${right}`,
  isEmpty: (noun, negated) => `${noun}が${negated ? '空でない' : '空である'}`,
  equals: (left, right, negated) => `${left}が${right}と${negated ? '等しくない' : '等しい'}`,
  compare: (left, right, comparison) => `${left}が${right}${japaneseComparison[comparison]}`,
  truth: (code, negated) => `${code}が${negated ? '偽である' : '真である'}`,
  stopWithMessage: (message) => `エラー「${message}」で止める`,
  stopWithCode: (code) => `エラー（${code}）で止める`,
  finish: '終える',
  returnCall: (step) => `${step}（その結果を返す）`,
  returnValue: (noun) => `${noun}を返す`,
  compute: (target, code) => `${target}を${code}で求める`,
  assign: (target, code) => `${target}を${code}にする`,
  when: (condition) => `${condition}場合`,
  otherwise: 'それ以外の場合',
  each: (noun) => `${noun}の1件ごとに`,
}

const englishComparison: Record<Comparison, string> = {
  less: 'is less than',
  greater: 'is greater than',
  atMost: 'is at most',
  atLeast: 'is at least',
}

/** 文の途中に置く手順（頭を小文字にする）。 */
function lowerFirst(step: string): string {
  return step.charAt(0).toLowerCase() + step.slice(1)
}

const english: Sentence = {
  quote: (value) => `“${value}”`,
  slot: (label) => `⟨${label}⟩`,
  empty: 'empty',
  amount: (amount) => `¥${amount.toLocaleString('en-US')}`,
  list: (items) => items.join(', '),
  pairs: (items) => items.map((item) => `${item.label}: ${item.value}`).join(', '),
  rowScope: (values) => `In the row with ${values.join(', ')}, `,
  rowOfScope: (table, conditions) => `In the row of “${table}” where ${conditions.map((condition) => `${condition.label} is ${condition.value}`).join(' and ')}, `,
  go: (page) => `Open “${page}”`,
  follow: (link) => `Follow the link ${link}`,
  fill: (field, value) => `Enter ${value} in ${field}`,
  choose: (field, option) => `Select ${option} in ${field}`,
  press: (button) => `Press “${button}”`,
  expectMessage: (message) => `Confirm that “${message}” appears`,
  expectAlert: (message) => `Confirm that the alert “${message}” appears`,
  expectProblem: (field, message) => `Confirm that “${message}” appears at ${field}`,
  expectHeading: (heading) => `Confirm that the “${heading}” screen opens`,
  expectCells: (table, cells) => `Confirm that the first row of “${table}” is ${cells}`,
  expectRows: (table) => `Confirm the rows of “${table}”`,
  expectText: (value) => `Confirm that ${value} appears`,
  expectNoButton: (button) => `Confirm that the “${button}” button does not appear`,
  expectOptions: (field, options) => `Confirm that the options of ${field} are ${options}`,
  givenValues: '(the given values)',
  launch: (tables) => (tables.length === 0 ? 'Open the screen' : `Open the screen (with rows of ${tables.join(', ')} in the database)`),
  operateWith: (scenario, changes) => (changes.length === 0 ? scenario : `${scenario} (with ${changes.join(', ')})`),
  change: (field, value) => `${field} set to ${value}`,
  confirmGuarantee: 'Confirm the success guarantee',
  confirmExtension: 'Confirm the handling of the extension',
  expectTable: (table, isEmpty) => (isEmpty ? `Confirm that ${table} in the database is empty` : `Confirm the rows of ${table} in the database`),
  expectSubject: (subject) => `Confirm that ${subject} is as expected`,
  elapse: (time, date) => (date === '' ? `${time} arrives` : `${time} arrives (${date})`),
  owned: (owner, item) => `${item} of ${owner}`,
  run: (code) => `Run ${code}`,
  isName: (noun, negated) => `${negated ? 'not ' : ''}${noun}`,
  hasName: (noun, negated) => `${negated ? 'no' : 'has'} ${noun}`,
  canName: (step, negated) => `${negated ? 'cannot' : 'can'} ${lowerFirst(step)}`,
  either: (left, right) => `${left}, or ${right}`,
  both: (left, right) => `${left}, and ${right}`,
  isEmpty: (noun, negated) => `${noun} is ${negated ? 'not empty' : 'empty'}`,
  equals: (left, right, negated) => `${left} ${negated ? 'does not equal' : 'equals'} ${right}`,
  compare: (left, right, comparison) => `${left} ${englishComparison[comparison]} ${right}`,
  truth: (code, negated) => `${code} is ${negated ? 'false' : 'true'}`,
  stopWithMessage: (message) => `Stop with the error “${message}”`,
  stopWithCode: (code) => `Stop with an error (${code})`,
  finish: 'Finish',
  returnCall: (step) => `${step} (return the result)`,
  returnValue: (noun) => `Return ${noun}`,
  compute: (target, code) => `Compute ${target} with ${code}`,
  assign: (target, code) => `Set ${target} to ${code}`,
  when: (condition) => `If ${condition}`,
  otherwise: 'Otherwise',
  each: (noun) => `For each of ${noun}`,
}

/** 見出しの名詞句を、文の途中の形にする（"Payment Creation" → "payment creation"。"ID" はそのまま）。 */
function lowerWords(label: string): string {
  return label
    .split(' ')
    .map((word) => (/^[A-Z][a-z]/.test(word) ? word.toLowerCase() : word))
    .join(' ')
}

export function prepareLanguage(locale: Locale): Language {
  return {
    locale,
    text: prepareText(locale),
    messages: new Map(Object.entries(listMessages(locale))),
    noun: (name) => renderNounPhrase(name, locale),
    phrase: (name) => (locale === 'ja' ? renderNounPhrase(name, locale) : lowerWords(renderNounPhrase(name, locale))),
    step: (name, receiverName) => translateStep(name, receiverName, locale),
    title: (name) => translateFunctionName(name, locale),
    sentence: locale === 'ja' ? japanese : english,
  }
}

export const locales = ['ja', 'en'] as const satisfies readonly Locale[]
