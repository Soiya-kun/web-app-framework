// Screen を Testing Library で動かす（インプロセスのテスト用）。ラベル・ボタン・見出しの名前で要素を探す。
import { screen as documentScreen, waitFor, within } from '@testing-library/dom'
import type { UserEvent } from '@testing-library/user-event'
import { isActionKey, type ActionKey, type LabelKey, type Text } from '@app/vocabulary/text'
import { computeAccessibleDescription } from 'dom-accessibility-api'
import type { CellValue, Screen } from './screen'

export type TestingScreenOption = {
  readonly user: UserEvent
  readonly text: Text
  /** 金額を、画面と同じ形の文字にする。 */
  readonly formatAmount: (amount: number) => string
}

type Scope = ReturnType<typeof within>

// 役割で探すとき hidden: true にする。jsdom で見えるかどうか（getComputedStyle）を全要素で計算すると重いため。
// このアプリは CSS で要素を隠さないので、結果は変わらない。

function ensureEqual(actual: unknown, expected: unknown, subject: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${subject}: ${JSON.stringify(actual)} が ${JSON.stringify(expected)} ではない`)
  }
}

export function prepareTestingScreen(option: TestingScreenOption): Screen {
  return prepareScope(option, async () => within(document.body))
}

function prepareScope(option: TestingScreenOption, readScope: () => Promise<Scope>): Screen {
  const { user, text } = option
  const nameButton = (button: ActionKey | LabelKey) => (isActionKey(button) ? text.action(button) : text.label(button as LabelKey))
  const formatCell = (value: CellValue) => (typeof value === 'number' ? option.formatAmount(value) : value)

  async function readTable(table: LabelKey) {
    const scope = await readScope()
    const element = await scope.findByRole('table', { name: text.label(table), hidden: true })
    const tableScope = within(element)
    const headers = tableScope.queryAllByRole('columnheader', { hidden: true }).map((header) => header.textContent ?? '')
    const rows = tableScope
      .getAllByRole('row', { hidden: true })
      .map((row) => within(row).queryAllByRole('cell', { hidden: true }).map((cell) => cell.textContent ?? ''))
      .filter((cells) => cells.length > 0)
    return { headers, rows }
  }

  return {
    async go(page) {
      const navigation = await documentScreen.findByRole('navigation', { hidden: true })
      await user.click(within(navigation).getByRole('link', { name: text.label(page), hidden: true }))
    },
    async follow(linkText) {
      const scope = await readScope()
      await user.click(await scope.findByRole('link', { name: linkText, hidden: true }))
    },
    async fill(field, value) {
      const scope = await readScope()
      const element = await scope.findByLabelText(text.label(field))
      if (element instanceof HTMLInputElement && element.value !== '') {
        await user.clear(element)
      }
      if (value !== '') {
        // 1文字ずつのキー操作は重いので、貼り付けで入れる（入力のイベントは1回だけ出る）。
        element.focus()
        await user.paste(value)
      }
    },
    async choose(field, choice) {
      const scope = await readScope()
      await user.selectOptions(await scope.findByLabelText(text.label(field)), choice)
    },
    async press(button) {
      const scope = await readScope()
      await user.click(await scope.findByRole('button', { name: nameButton(button), hidden: true }))
    },
    row(...rowTexts) {
      return prepareScope(option, async () => {
        const scope = await readScope()
        const rows = await waitFor(() => {
          const matched = scope.getAllByRole('row', { hidden: true }).filter((row: HTMLElement) => rowTexts.every((rowText) => (row.textContent ?? '').includes(rowText)))
          if (matched.length !== 1) {
            throw new Error(`「${rowTexts.join('・')}」を含む行が ${matched.length} 行ある（1行にする）`)
          }
          return matched
        })
        return within(rows[0] as HTMLElement)
      })
    },
    rowOf(table, cells) {
      return prepareScope(option, async () => {
        const scope = await readScope()
        const row = await waitFor(() => {
          const tableElement = scope.getByRole('table', { name: text.label(table), hidden: true })
          const headers = within(tableElement)
            .queryAllByRole('columnheader', { hidden: true })
            .map((header) => header.textContent ?? '')
          const expected = Object.entries(cells).map(([column, value]) => [headers.indexOf(text.label(column as LabelKey)), formatCell(value as CellValue)] as const)
          const matched = within(tableElement)
            .getAllByRole('row', { hidden: true })
            .filter((rowElement: HTMLElement) => {
              const values = within(rowElement)
                .queryAllByRole('cell', { hidden: true })
                .map((cell) => cell.textContent ?? '')
              return values.length > 0 && expected.every(([index, value]) => values[index] === value)
            })
          if (matched.length !== 1) {
            throw new Error(`「${text.label(table)}」に ${JSON.stringify(cells)} の行が ${matched.length} 行ある（1行にする）`)
          }
          return matched[0] as HTMLElement
        })
        return within(row)
      })
    },
    async expectMessage(message, params) {
      const expected = text.message(message, params)
      await waitFor(() => ensureEqual(documentScreen.getByRole('status', { hidden: true }).textContent, expected, '知らせ'))
    },
    async expectAlert(message, params) {
      const expected = text.message(message, params)
      await waitFor(() => ensureEqual(documentScreen.getByRole('alert', { hidden: true }).textContent, expected, '警告'))
    },
    async expectProblem(field, message, params = {}) {
      const fieldName = text.label(field)
      const expected = text.message(message, { ...params, field: fieldName })
      await waitFor(async () => {
        const scope = await readScope()
        ensureEqual(computeAccessibleDescription(scope.getByLabelText(fieldName)), expected, `${fieldName}の問題`)
      })
    },
    async expectHeading(heading) {
      await documentScreen.findByRole('heading', { name: text.label(heading), hidden: true })
    },
    async expectCells(table, cells) {
      await waitFor(async () => {
        const { headers, rows } = await readTable(table)
        const columns = Object.keys(cells).map((column) => text.label(column as LabelKey))
        const actual = Object.fromEntries(columns.map((column) => [column, rows[0]?.[headers.indexOf(column)]]))
        const expected = Object.fromEntries(
          Object.entries(cells).map(([column, value]) => [text.label(column as LabelKey), formatCell(value as CellValue)]),
        )
        ensureEqual(actual, expected, `${text.label(table)}の1行目`)
      })
    },
    async expectRows(table, rows) {
      await waitFor(async () => {
        ensureEqual((await readTable(table)).rows, rows.map((cells) => cells.map(formatCell)), `${text.label(table)}の行`)
      })
    },
    async expectText(expected) {
      const scope = await readScope()
      await scope.findByText(expected)
    },
    async expectNoButton(button) {
      const scope = await readScope()
      ensureEqual(scope.queryByRole('button', { name: nameButton(button), hidden: true }), null, `ボタン「${nameButton(button)}」`)
    },
    async expectOptions(field, options) {
      const scope = await readScope()
      const element = await scope.findByLabelText(text.label(field))
      ensureEqual(
        within(element).getAllByRole('option', { hidden: true }).map((choice) => choice.textContent),
        options,
        `${text.label(field)}の選択肢`,
      )
    },
  }
}
