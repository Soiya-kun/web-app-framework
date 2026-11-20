// Screen を Playwright で動かす（実ブラウザのテスト用）。インプロセスの testing.ts と同じく、ラベル・ボタン・見出しの名前で要素を探す。
// シナリオの中身は変えずに、同じ手順を本物のブラウザ・API サーバー・DB で流せる。
import { isActionKey, type ActionKey, type LabelKey, type Text } from '@app/vocabulary/text'
import type { Locator, Page } from 'playwright'
import type { CellValue, Screen } from './screen'

export type PlaywrightScreenOption = {
  readonly page: Page
  readonly text: Text
  /** 金額を、画面と同じ形の文字にする。 */
  readonly formatAmount: (amount: number) => string
  /** 期待した表示になるまで待つ時間（ミリ秒）。 */
  readonly timeout?: number
}

function ensureEqual(actual: unknown, expected: unknown, subject: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${subject}: ${JSON.stringify(actual)} が ${JSON.stringify(expected)} ではない`)
  }
}

/** 確かめが通るまで、少しずつ待って繰り返す。時間が過ぎたら、最後の失敗を投げる。 */
async function waitUntil(check: () => Promise<void>, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout
  for (;;) {
    try {
      await check()
      return
    } catch (error) {
      if (Date.now() > deadline) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
}

export function preparePlaywrightScreen(option: PlaywrightScreenOption): Screen {
  return prepareScope(option, async () => option.page.locator('body'))
}

function prepareScope(option: PlaywrightScreenOption, readScope: () => Promise<Locator>): Screen {
  const { page, text } = option
  const timeout = option.timeout ?? 5000
  // 待つ確かめの中の1回の読み取りは、すぐ返す（待つのは waitUntil が受け持つ）。
  const quick = { timeout: 200 }
  const nameButton = (button: ActionKey | LabelKey) => (isActionKey(button) ? text.action(button) : text.label(button as LabelKey))
  const formatCell = (value: CellValue) => (typeof value === 'number' ? option.formatAmount(value) : value)
  const findField = async (field: LabelKey) => (await readScope()).getByLabel(text.label(field), { exact: true })

  async function readTable(table: LabelKey) {
    const element = (await readScope()).getByRole('table', { name: text.label(table), exact: true })
    const headers = await element.getByRole('columnheader').allTextContents()
    const rowElements = await element.getByRole('row').all()
    const rows = (await Promise.all(rowElements.map((row) => row.getByRole('cell').allTextContents()))).filter((cells) => cells.length > 0)
    return { headers, rows }
  }

  return {
    async go(pageName) {
      await page.getByRole('navigation').getByRole('link', { name: text.label(pageName), exact: true }).click()
    },
    async follow(linkText) {
      await (await readScope()).getByRole('link', { name: linkText, exact: true }).click()
    },
    async fill(field, value) {
      // fill は前の値を消してから入れる。空なら消すだけ。
      await (await findField(field)).fill(value)
    },
    async choose(field, choice) {
      // 文字は、選択肢の値と表示の名前のどちらにも当たる（空なら「選んでください」の値 ''）。
      await (await findField(field)).selectOption(choice)
    },
    async press(button) {
      await (await readScope()).getByRole('button', { name: nameButton(button), exact: true }).click()
    },
    row(...rowTexts) {
      return prepareScope(option, async () => {
        const scope = await readScope()
        const rows = rowTexts.reduce((matched, rowText) => matched.filter({ hasText: rowText }), scope.getByRole('row'))
        await waitUntil(async () => {
          const count = await rows.count()
          if (count !== 1) {
            throw new Error(`「${rowTexts.join('・')}」を含む行が ${count} 行ある（1行にする）`)
          }
        }, timeout)
        return rows
      })
    },
    rowOf(table, cells) {
      return prepareScope(option, async () => {
        const tableElement = (await readScope()).getByRole('table', { name: text.label(table), exact: true })
        let matchedIndex = -1
        await waitUntil(async () => {
          const headers = await tableElement.getByRole('columnheader').allTextContents()
          const expected = Object.entries(cells).map(([column, value]) => [headers.indexOf(text.label(column as LabelKey)), formatCell(value as CellValue)] as const)
          const rowValues = await Promise.all((await tableElement.getByRole('row').all()).map((row) => row.getByRole('cell').allTextContents()))
          const matched = rowValues.flatMap((values, index) =>
            values.length > 0 && expected.every(([column, value]) => values[column] === value) ? [index] : [],
          )
          if (matched.length !== 1) {
            throw new Error(`「${text.label(table)}」に ${JSON.stringify(cells)} の行が ${matched.length} 行ある（1行にする）`)
          }
          matchedIndex = matched[0] ?? -1
        }, timeout)
        return tableElement.getByRole('row').nth(matchedIndex)
      })
    },
    async expectMessage(message, params) {
      const expected = text.message(message, params)
      await waitUntil(async () => ensureEqual(await page.getByRole('status').textContent(quick), expected, '知らせ'), timeout)
    },
    async expectAlert(message, params) {
      const expected = text.message(message, params)
      await waitUntil(async () => ensureEqual(await page.getByRole('alert').textContent(quick), expected, '警告'), timeout)
    },
    async expectProblem(field, message, params = {}) {
      const fieldName = text.label(field)
      const expected = text.message(message, { ...params, field: fieldName })
      await waitUntil(async () => {
        // 入力欄の説明（aria-describedby が指す要素の文）を読む。
        const description = await (await findField(field)).evaluate(
          (element) =>
            (element.getAttribute('aria-describedby') ?? '')
              .split(/\s+/)
              .filter((id) => id !== '')
              .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
              .join(' ')
              .trim(),
          undefined,
          quick,
        )
        ensureEqual(description, expected, `${fieldName}の問題`)
      }, timeout)
    },
    async expectHeading(heading) {
      await page.getByRole('heading', { name: text.label(heading), exact: true }).waitFor({ timeout })
    },
    async expectCells(table, cells) {
      await waitUntil(async () => {
        const { headers, rows } = await readTable(table)
        const columns = Object.keys(cells).map((column) => text.label(column as LabelKey))
        const actual = Object.fromEntries(columns.map((column) => [column, rows[0]?.[headers.indexOf(column)]]))
        const expected = Object.fromEntries(
          Object.entries(cells).map(([column, value]) => [text.label(column as LabelKey), formatCell(value as CellValue)]),
        )
        ensureEqual(actual, expected, `${text.label(table)}の1行目`)
      }, timeout)
    },
    async expectRows(table, rows) {
      await waitUntil(async () => {
        ensureEqual((await readTable(table)).rows, rows.map((cells) => cells.map(formatCell)), `${text.label(table)}の行`)
      }, timeout)
    },
    async expectText(expected) {
      await (await readScope()).getByText(expected, { exact: true }).waitFor({ timeout })
    },
    async expectNoButton(button) {
      const count = await (await readScope()).getByRole('button', { name: nameButton(button), exact: true }).count()
      ensureEqual(count, 0, `ボタン「${nameButton(button)}」の数`)
    },
    async expectOptions(field, options) {
      const element = await findField(field)
      await element.waitFor({ timeout })
      ensureEqual(await element.locator('option').allTextContents(), options, `${text.label(field)}の選択肢`)
    },
  }
}
