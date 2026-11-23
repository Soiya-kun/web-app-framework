// 業務フローの段を、モックの画面（実ブラウザ）で流す。シナリオの操作は Screen の言い方で書かれているので、
// テストと同じ Testing Library の実装（@app/flow/testing）を、画面の DOM にそのまま当てる。
import { runFlowPath, type PathAction, type Screen } from '@app/flow'
import { prepareTestingScreen } from '@app/flow/testing'
import { translateStep } from '@app/vocabulary'
import { isActionKey, prepareText, type ActionKey, type LabelKey } from '@app/vocabulary/text'
import { userEvent, type UserEvent } from '@testing-library/user-event'
import { displayYen } from '../../src/shared/yen'

const text = prepareText('ja')

/** 画面を操作するシナリオの段。 */
export type OperateAction = Extract<PathAction, { readonly kind: 'operate' }>

/** Screen の操作の名前（表の行の中へ入る row・rowOf を除く）。 */
type ScreenMethod = Exclude<keyof Screen, 'row' | 'rowOf'>

/** シナリオが画面にした1つの操作。scope は、表の行の中で操作したときの行の説明（「「アイテム」の、行が「1」の行で、」）。 */
export type ScreenCall = {
  readonly method: ScreenMethod
  readonly parts: readonly unknown[]
  readonly scope: readonly string[]
}

/** 操作の前に呼ぶ。'skip' を返すと、その操作をしない。 */
type ScreenHook = (call: ScreenCall) => Promise<'run' | 'skip'>

function nameButton(button: ActionKey | LabelKey): string {
  return isActionKey(button) ? text.action(button) : text.label(button)
}

/** Screen の操作の前に hook を挟む。表の行の中の操作にも挟む。 */
function wrapScreen(screen: Screen, hook: ScreenHook, scope: readonly string[] = []): Screen {
  const forward = <Method extends ScreenMethod>(method: Method) =>
    (async (...parts: Parameters<Screen[Method]>) => {
      if ((await hook({ method, parts, scope })) === 'skip') {
        return
      }
      await (screen[method] as (...parts: Parameters<Screen[Method]>) => Promise<void>)(...parts)
    }) as Screen[Method]
  return {
    go: forward('go'),
    follow: forward('follow'),
    fill: forward('fill'),
    choose: forward('choose'),
    press: forward('press'),
    row: (...rowTexts) => wrapScreen(screen.row(...rowTexts), hook, [...scope, `「${rowTexts.join('・')}」を含む行で、`]),
    rowOf: (table, cells) =>
      wrapScreen(screen.rowOf(table, cells), hook, [
        ...scope,
        `「${text.label(table)}」の、${Object.entries(cells)
          .map(([column, value]) => `${text.label(column as LabelKey)}が「${String(value)}」`)
          .join('・')}の行で、`,
      ]),
    expectMessage: forward('expectMessage'),
    expectAlert: forward('expectAlert'),
    expectProblem: forward('expectProblem'),
    expectHeading: forward('expectHeading'),
    expectCells: forward('expectCells'),
    expectRows: forward('expectRows'),
    expectText: forward('expectText'),
    expectNoButton: forward('expectNoButton'),
    expectOptions: forward('expectOptions'),
  }
}

/** 何もしない Screen。シナリオの操作を、画面に触らずに書き留めるときの土台にする。 */
function prepareSilentScreen(): Screen {
  const nothing = async () => undefined
  const screen: Screen = {
    go: nothing,
    follow: nothing,
    fill: nothing,
    choose: nothing,
    press: nothing,
    row: () => screen,
    rowOf: () => screen,
    expectMessage: nothing,
    expectAlert: nothing,
    expectProblem: nothing,
    expectHeading: nothing,
    expectCells: nothing,
    expectRows: nothing,
    expectText: nothing,
    expectNoButton: nothing,
    expectOptions: nothing,
  }
  return screen
}

/** シナリオの段の操作を、画面に触らずに書き留める（最初に開く画面・最後に押すボタンを知るため）。 */
export async function recordCalls(action: OperateAction): Promise<readonly ScreenCall[]> {
  const calls: ScreenCall[] = []
  await action.scenario.operate?.(
    wrapScreen(prepareSilentScreen(), async (call) => {
      calls.push(call)
      return 'skip'
    }),
    action.input,
  )
  return calls
}

/** 操作を、画面の言葉の1文にする（「納入先コードに「C101」を入れる」）。 */
export function describeCall(call: ScreenCall): string {
  const [first, second] = call.parts
  const sentence = (() => {
    switch (call.method) {
      case 'go':
        return `「${text.label(first as LabelKey)}」を開く`
      case 'follow':
        return `「${String(first)}」のリンクを開く`
      case 'fill':
        return second === '' ? `${text.label(first as LabelKey)}を消す` : `${text.label(first as LabelKey)}に「${String(second)}」を入れる`
      case 'choose':
        return `${text.label(first as LabelKey)}で「${String(second)}」を選ぶ`
      case 'press':
        return `「${nameButton(first as ActionKey | LabelKey)}」を押す`
      default:
        return '結果を確かめる'
    }
  })()
  return `${call.scope.join('')}${sentence}`
}

/** シナリオの名前を日本語にする（「受注を登録する」）。訳せなければ名前のまま。 */
export function translateScenario(name: string): string {
  return translateStep(name) ?? name
}

/** 画面で操作した要素を見せる。caption は、その操作の1文。 */
export type HighlightElement = (element: Element, caption: string) => Promise<void>

/**
 * ゆっくり見せるときの UserEvent。押す・入れる要素を、操作の前に highlight で見せる。
 * 1つの操作（入れる＝消してから貼り付ける など）で何度呼ばれても、見せるのは最初の1回だけにする。
 */
function prepareShowingUser(user: UserEvent, highlight: (element: Element) => Promise<void>): UserEvent {
  return {
    ...user,
    click: async (element, ...rest) => {
      await highlight(element)
      return user.click(element, ...rest)
    },
    clear: async (element) => {
      await highlight(element)
      return user.clear(element)
    },
    selectOptions: async (element, values, ...rest) => {
      await highlight(element)
      return user.selectOptions(element, values, ...rest)
    },
    upload: async (element, files, ...rest) => {
      await highlight(element)
      return user.upload(element, files, ...rest)
    },
    paste: async (...parts) => {
      if (document.activeElement !== null) {
        await highlight(document.activeElement)
      }
      return user.paste(...parts)
    },
  }
}

/** 入力欄の値を、画面（React）が変更に気づく形で変える（値を書き、input のイベントを出す）。 */
function writeValue(element: Element, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * 実ブラウザで入力欄を消す・貼り付ける UserEvent。UserEvent は入力欄の値を自分でも覚えていて、
 * 画面が値を描き直すと覚えた値とずれ、次の貼り付けが前の値に足される（「C101C101」）。消す・貼り付けるだけは、値を直接書く。
 */
function prepareBrowserUser(user: UserEvent): UserEvent {
  return {
    ...user,
    clear: async (element) => {
      writeValue(element, '')
    },
    paste: async (pasted) => {
      const element = document.activeElement
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
        return user.paste(pasted)
      }
      writeValue(element, `${element.value}${typeof pasted === 'string' ? pasted : (pasted?.getData('text') ?? '')}`)
    },
  }
}

export type MockScreenOption = {
  /** 渡すと、操作する要素を1つずつ見せながら（ゆっくり）動かす。 */
  readonly highlight?: HighlightElement
  /** 操作の前ごとに待つ（実ブラウザで、画面の読み込みと描き直しが落ち着くまで）。 */
  readonly settle?: () => Promise<void>
}

/** モックの画面を、シナリオの操作で動かす Screen（テストと同じ Testing Library の実装）。 */
export function prepareMockScreen(option: MockScreenOption = {}): Screen {
  const { highlight, settle } = option
  const user = prepareBrowserUser(userEvent.setup())
  const formatAmount = (amount: number) => displayYen('ja', amount)
  let caption = ''
  let shownCaption: string | undefined
  const actingUser =
    highlight === undefined
      ? user
      : prepareShowingUser(user, async (element) => {
          if (shownCaption === caption) {
            return
          }
          shownCaption = caption
          await highlight(element, caption)
        })
  const screen = prepareTestingScreen({ user: actingUser, text, formatAmount })
  if (highlight === undefined && settle === undefined) {
    return screen
  }
  return wrapScreen(screen, async (call) => {
    await settle?.()
    caption = describeCall(call)
    shownCaption = undefined
    return 'run'
  })
}

/** 段を1つ流す（時の経過なら今日を変える）。未着手のシナリオなら、その名前を返す。 */
export async function runAction(action: PathAction, screen: Screen, assignToday: (date: string) => Promise<void>): Promise<string | undefined> {
  const result = await runFlowPath({ key: action.number, title: action.number, actions: [action] }, screen, assignToday)
  return result.pendingAt
}

/** シナリオの段の入力だけを入れる。最後に押すボタン（登録など）は押さずに残し、人が押せるようにする。 */
export async function fillAction(action: OperateAction, screen: Screen): Promise<void> {
  const calls = await recordCalls(action)
  const lastPress = calls.filter((call) => call.method === 'press').length
  let pressCount = 0
  await action.scenario.operate?.(
    wrapScreen(screen, async (call) => {
      if (call.method !== 'press') {
        return 'run'
      }
      pressCount += 1
      return pressCount === lastPress ? 'skip' : 'run'
    }),
    action.input,
  )
}

/** シナリオの段が最初に開く画面を開く（画面のナビゲーションから）。最初に画面を開かないシナリオなら何もしない。 */
export async function openActionPage(action: OperateAction, screen: Screen): Promise<void> {
  const [firstCall] = await recordCalls(action)
  if (firstCall?.method === 'go') {
    await screen.go(firstCall.parts[0] as LabelKey)
  }
}
