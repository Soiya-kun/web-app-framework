// コードのブラウザの画面のテスト。このリポジトリのソースを解析したモデルを渡し、業務フローから SQL までたどれることを確かめる。
import { buildModel } from '@app/translator/model'
import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
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
    const { user } = await launchBrowser('/')

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
