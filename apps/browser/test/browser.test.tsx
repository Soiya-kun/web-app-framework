// コードのブラウザの画面のテスト。このリポジトリのソースを解析したモデルを渡し、業務フローから SQL までたどれることを確かめる。
import { buildModel } from '@app/translator/model'
import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PointerEventsCheckLevel, userEvent } from '@testing-library/user-event'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { AppRoot } from '../src/appRoot'
import { prepareRouter } from '../src/router'

const model = buildModel(join(dirname(fileURLToPath(import.meta.url)), '../../..'))

async function launchBrowser(path: string) {
  const router = prepareRouter(createMemoryHistory({ initialEntries: [path] }))
  await router.load()
  const user = userEvent.setup({ delay: null, pointerEventsCheck: PointerEventsCheckLevel.Never })
  render(<AppRoot model={model} router={router} />)
  return { user }
}

describe('コードのブラウザ', () => {
  test('業務フローのレーン図に、子フローを開いた段を担当ごとに並べる', async () => {
    await launchBrowser('/flow/monthlyInvoice')

    const diagram = screen.getByRole('figure', { name: '月次の請求のレーン図' })
    expect(within(diagram).getByText('営業担当')).toBeVisible()
    expect(within(diagram).getByText('時の経過')).toBeVisible()
    expect(within(diagram).getByRole('link', { name: /8\.2・画面操作・拡張\s*入金を記録する/ })).toBeVisible()
    expect(within(diagram).getByRole('link', { name: '子フロー: 入金管理' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'テストの経路' })).toHaveTextContent('8.2a. 振込依頼人名から顧客を特定できない')
  })

  test('段 → シナリオ → 処理 → SQL とたどれる', async () => {
    const { user } = await launchBrowser('/flow/paymentManagement')

    await user.click(within(screen.getByRole('region', { name: '手順' })).getByRole('link', { name: '入金を記録する' }))
    expect(await screen.findByRole('heading', { name: '入金を記録する' })).toBeVisible()
    expect(screen.getByRole('list', { name: '主な成功シナリオ' })).toHaveTextContent('「記録」を押す')

    await user.click(within(screen.getByRole('region', { name: '処理' })).getByRole('link', { name: '入金の記録' }))
    expect(await screen.findByRole('heading', { name: '入金の記録' })).toBeVisible()

    await user.click(screen.getByRole('link', { name: 'createPayment' }))
    expect(await screen.findByLabelText('createPayment')).toHaveTextContent('INSERT INTO payment')
  })

  test('名前の一部で、業務フロー・シナリオ・処理・テーブルを探せる', async () => {
    const { user } = await launchBrowser('/list')

    await user.type(screen.getByLabelText('検索'), '入金')

    const results = screen.getByRole('region', { name: '検索の結果' })
    expect(within(results).getByRole('link', { name: '入金管理' })).toBeVisible()
    expect(within(results).getByRole('link', { name: '入金を記録する' })).toBeVisible()
    expect(within(results).getByRole('link', { name: '入金' })).toBeVisible()
  })

  test('用語集は、日本語・英語・名前で絞り込める', async () => {
    const { user } = await launchBrowser('/glossary')

    await user.type(screen.getByLabelText('検索'), 'billing')

    expect(screen.getByRole('region', { name: /用語集/ })).toHaveTextContent('請求先')
  })
})

describe('キャンバス', () => {
  test('業務フローをフレームとして並べ、最上位は開き、子フローは閉じて置く', async () => {
    await launchBrowser('/')

    expect(screen.getByRole('figure', { name: '月次の請求のレーン図' })).toBeVisible()
    expect(screen.getByRole('button', { name: /^入金管理/, expanded: false })).toBeVisible()
  })

  test('子フローを開き、段 → シナリオ → 処理 → SQL → テーブルとカードを開いていける', async () => {
    const { user } = await launchBrowser('/')
    const frame = screen.getByRole('region', { name: '月次の請求' })

    await user.click(within(frame).getByRole('button', { name: '8 入金管理' }))
    await user.click(within(frame).getByRole('button', { name: '8.2 入金を記録する' }))
    const scenarioCard = within(frame).getByRole('article', { name: '入金を記録する' })
    expect(within(scenarioCard).getByRole('list', { name: '主な成功シナリオ' })).toHaveTextContent('「記録」を押す')

    await user.click(within(scenarioCard).getByRole('button', { name: /入金の記録/ }))
    const workCard = within(frame).getByRole('article', { name: '入金の記録' })
    await user.click(within(workCard).getByRole('button', { name: /createPayment/ }))
    const statementCard = within(frame).getByRole('article', { name: 'createPayment' })
    expect(within(statementCard).getByLabelText('createPayment')).toHaveTextContent('INSERT INTO payment')

    await user.click(within(statementCard).getByRole('button', { name: /入金/ }))
    expect(within(frame).getByRole('article', { name: '入金' })).toHaveTextContent('payer_name')

    await user.click(within(frame).getByRole('button', { name: '8.2 入金を記録する' }))
    expect(within(frame).queryByRole('article', { name: '入金を記録する' })).toBeNull()
  })

  test('ボタン・Ctrl＋ホイールで拡大・縮小し、背景のドラッグで動かす', async () => {
    const { user } = await launchBrowser('/')
    const canvas = screen.getByRole('application', { name: 'キャンバス' })
    const scaleButton = screen.getByRole('button', { name: '倍率' })
    const board = canvas.firstElementChild as HTMLElement

    await user.click(screen.getByRole('button', { name: '拡大' }))
    expect(scaleButton).toHaveTextContent('125%')
    fireEvent.wheel(canvas, { ctrlKey: true, deltaY: 200 })
    expect(Number.parseInt(scaleButton.textContent ?? '', 10)).toBeLessThan(125)
    await user.click(scaleButton)
    expect(scaleButton).toHaveTextContent('100%')

    const initialStyle = board.style.transform
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 160, clientY: 130 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })
    expect(board.style.transform).not.toBe(initialStyle)
  })

  test('開いた段・カードとフレームの位置を保存し、開き直しても同じところから続ける', async () => {
    const { user } = await launchBrowser('/')
    const frame = screen.getByRole('region', { name: '月次の請求' })
    await user.click(within(frame).getByRole('button', { name: '4 請求を締める' }))
    await user.click(within(within(frame).getByRole('article', { name: '請求を締める' })).getByRole('button', { name: /請求の締め/ }))
    cleanup()

    await launchBrowser('/')

    const restoredFrame = screen.getByRole('region', { name: '月次の請求' })
    expect(within(restoredFrame).getByRole('article', { name: '請求を締める' })).toBeVisible()
    expect(within(restoredFrame).getByRole('article', { name: '請求の締め' })).toBeVisible()
  })

  test('フレームの名前をドラッグすると動き、押しただけなら開閉する', async () => {
    await launchBrowser('/')
    const title = screen.getByRole('button', { name: /^月次の請求/, expanded: true })
    const frameElement = title.closest('[data-frame]') as HTMLElement

    fireEvent.pointerDown(title, { button: 0, pointerId: 2, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(title, { pointerId: 2, clientX: 110, clientY: 60 })
    fireEvent.pointerUp(title, { pointerId: 2 })
    fireEvent.click(title)

    expect(frameElement.style.transform).toBe('translate(100px, 50px)')
    expect(title).toHaveAttribute('aria-expanded', 'true')
  })

  test('名前で探すと、その段（拡張の中の段も）のカードを開く', async () => {
    const { user } = await launchBrowser('/')

    await user.type(screen.getByRole('combobox', { name: '検索' }), '締めを取り消す')
    await user.click(screen.getByRole('option', { name: /締めを取り消す/ }))

    const frame = screen.getByRole('region', { name: '月次の請求' })
    expect(within(frame).getByRole('article', { name: '請求を閲覧する' })).toBeVisible()
    expect(within(frame).getByRole('article', { name: '締めを取り消す' })).toBeVisible()
  })

  test('初期化すると、開いたカードとフレームの位置を最初に戻す', async () => {
    const { user } = await launchBrowser('/')
    const frame = screen.getByRole('region', { name: '月次の請求' })
    await user.click(within(frame).getByRole('button', { name: '2 売上を登録する' }))
    expect(within(frame).getByRole('article', { name: '売上を登録する' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: '初期化' }))

    expect(within(frame).queryByRole('article', { name: '売上を登録する' })).toBeNull()
  })

  test('ミニマップを出す', async () => {
    await launchBrowser('/')

    expect(screen.getByRole('img', { name: 'ミニマップ' })).toBeVisible()
  })
})
