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

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const models = { ja: buildModel(repositoryRoot, 'ja'), en: buildModel(repositoryRoot, 'en') }

async function launchBrowser(path: string) {
  const router = prepareRouter(createMemoryHistory({ initialEntries: [path] }))
  await router.load()
  const user = userEvent.setup({ delay: null, pointerEventsCheck: PointerEventsCheckLevel.Never })
  render(<AppRoot models={models} router={router} />)
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

  test('業務フローを業務の領域ごとにまとめ、未着手のシナリオのある業務フローに印を付ける', async () => {
    await launchBrowser('/')

    const layer = screen.getByRole('complementary', { name: 'レイヤー' })
    expect(within(layer).getAllByRole('heading', { level: 3 }).map((title) => title.textContent)).toEqual(['請求', '入金', '売上', '顧客'])
    expect(within(layer).getByRole('button', { name: /^過入金の返金/ })).toHaveTextContent('未着手 1')
    expect(within(layer).getByRole('button', { name: /^分割入金/ })).not.toHaveTextContent('未着手')
    const paymentArea = screen.getByRole('region', { name: '入金' })
    expect(within(paymentArea).getByRole('region', { name: '分割入金' })).toBeInTheDocument()
    expect(within(paymentArea).queryByRole('region', { name: '月次の請求' })).toBeNull()
  })

  test('言語を英語に切り替えると、画面の文言と、業務フロー・シナリオの見出し・手順が英語になり、ブラウザに覚える', async () => {
    const { user } = await launchBrowser('/')

    await user.click(screen.getByRole('button', { name: '言語: English' }))

    const layer = screen.getByRole('complementary', { name: 'Layer' })
    expect(within(layer).getAllByRole('heading', { level: 3 }).map((title) => title.textContent)).toEqual(['Invoice', 'Payment', 'Sales', 'Customer'])
    expect(within(layer).getByRole('button', { name: /^Overpayment Refund/ })).toHaveTextContent('Pending 1')
    const frame = screen.getByRole('region', { name: 'Monthly Invoice' })
    await user.click(within(frame).getByRole('button', { name: '2 Create sales' }))
    expect(within(within(frame).getByRole('article', { name: 'Create sales' })).getByRole('list', { name: 'Primary Success Scenario' })).toHaveTextContent('Press “Create”')
    expect(window.localStorage.getItem('code-browser:locale')).toBe('en')

    await user.click(screen.getByRole('button', { name: 'Locale: 日本語' }))
    expect(screen.getByRole('region', { name: '月次の請求' })).toBeInTheDocument()
  })

  test('議事録の一覧に、まだ解決していない課題（担当者・期限）と、回ごとの決めたこと・課題の数を出す', async () => {
    await launchBrowser('/meetings')

    const openSection = screen.getByRole('region', { name: '未解決の課題（2）' })
    expect(openSection).toHaveTextContent('返金を登録する画面で、振込先の口座まで入れるか')
    expect(openSection).toHaveTextContent('担当者: 経理担当')
    expect(openSection).toHaveTextContent('期限: 2026-11-14')
    const minutes = screen.getByRole('table', { name: '議事録' })
    expect(within(minutes).getByRole('row', { name: /第2回/ }).textContent).toBe('2026-10-17第2回（入金の業務）422')
    expect(screen.getByRole('region', { name: '役割' })).toHaveTextContent('PM')
  })

  test('回ごとの議事録に、出席者・議題・決めたこと（解決した課題）・課題を、指している場所へのリンク付きで出す', async () => {
    const { user } = await launchBrowser('/meeting/meeting20261017')

    expect(screen.getByRole('heading', { name: '第2回（入金の業務）' })).toBeVisible()
    expect(screen.getByRole('region', { name: '出席者' })).toHaveTextContent('開発チーム')
    const decisionList = screen.getByRole('region', { name: '決定（4）' })
    expect(decisionList).toHaveTextContent('振込手数料は当社の負担とし')
    expect(decisionList).toHaveTextContent('解決済みの課題: 振込手数料を差し引いて入金されたとき')
    // 決めたことは、画面（入金一覧）や規則も指せる。
    expect(decisionList).toHaveTextContent('入金を記録する › 振込依頼人名から顧客を特定できない・入金一覧')
    const questions = screen.getByRole('region', { name: '課題（2）' })
    expect(questions).toHaveTextContent('解決済み')
    await user.click(within(questions).getAllByRole('link', { name: '返金を登録する' })[0]!)
    expect(screen.getByRole('heading', { name: '返金を登録する' })).toBeVisible()
    expect(screen.getByRole('region', { name: '課題（1）' })).toHaveTextContent('振込先の口座')
  })

  test('処理のページに、その処理を指して決めたことを出す', async () => {
    await launchBrowser('/work/closeInvoice')

    expect(screen.getByRole('region', { name: '決定（1）' })).toHaveTextContent('締めた後に登録した、締め日以前の売上は、次の締めに載せる')
    expect(screen.queryByRole('region', { name: '課題（0）' })).toBeNull()
  })

  test('現行の一覧に、現行の業務フロー（置き換え先と変わり方の数）と旧システムのテーブルを出す', async () => {
    await launchBrowser('/legacy')

    const legacySection = screen.getByRole('region', { name: '現行の業務フロー（1）' })
    expect(legacySection).toHaveTextContent('現行の月次の請求 → 月次の請求')
    expect(legacySection).toHaveTextContent('同じ 3・置き換え 4・廃止 1・新しい段 2')
    expect(within(screen.getByRole('table', { name: '旧システムのテーブル' })).getByRole('row', { name: /売上伝票/ })).toHaveTextContent('T_URIAGE')
  })

  test('現行の業務フローのページで、段ごとの変わり方と置き換え先、新しい段を、新しい業務フローと比べて出す', async () => {
    const { user } = await launchBrowser('/legacy/legacyMonthlyInvoice')

    expect(screen.getByRole('heading', { name: '現行の月次の請求' })).toBeVisible()
    expect(screen.getByRole('figure', { name: '現行の月次の請求のレーン図' })).toHaveTextContent('旧システムの操作')
    const comparison = screen.getByRole('table', { name: '現行の月次の請求の比較' })
    expect(within(comparison).getByRole('row', { name: /請求を印刷する/ })).toHaveTextContent('置き換え請求を締める・請求を発行する売上伝票・請求')
    expect(within(comparison).getByRole('row', { name: /請求をコピーする/ })).toHaveTextContent('廃止')
    expect(within(comparison).getByRole('row', { name: /請求を支払う/ })).toHaveTextContent('同じ')
    expect(screen.getByRole('region', { name: '新しい段（2）' })).toHaveTextContent('8.3入金を閲覧する')
    // 旧システムの画面の手順と、置き換え先のシナリオの手順を並べる。
    const screenComparison = screen.getByRole('region', { name: '画面の比較' })
    expect(within(screenComparison).getByRole('list', { name: '売上を記入するの手順' })).toHaveTextContent('「売上伝票入力」を開く')
    expect(within(screenComparison).getByRole('list', { name: '売上を登録するの手順' })).toHaveTextContent('「売上登録」を開く')

    await user.click(within(within(comparison).getByRole('row', { name: /売上を記入する/ })).getByRole('link', { name: '売上伝票' }))
    expect(screen.getByRole('heading', { name: '売上伝票' })).toBeVisible()
    expect(within(screen.getByRole('table', { name: '売上伝票の列' })).getByRole('row', { name: /売上日/ })).toHaveTextContent('sales.sales_date')
  })

  test('見積の一覧に版ごとの合計と、いちばん新しい見積にないシナリオを出し、1つの版の項目と対象・前の版との差を出す', async () => {
    const { user } = await launchBrowser('/estimates')

    const estimates = screen.getByRole('table', { name: '見積' })
    expect(within(estimates).getByRole('row', { name: /概算見積/ })).toHaveTextContent('￥6,400,000')
    expect(screen.getByRole('region', { name: '未見積のシナリオ（1）' })).toHaveTextContent('調整を登録する')

    await user.click(within(estimates).getByRole('link', { name: '見積（第3回の打合せのあと）' }))
    const items = screen.getByRole('table', { name: '見積（第3回の打合せのあと）の見積項目' })
    expect(within(items).getByRole('row', { name: /売上の登録/ })).toHaveTextContent('売上を登録する・売上登録￥400,000')
    expect(within(items).getByRole('row', { name: /合計/ })).toHaveTextContent('概算見積（-￥600,000）￥5,800,000')
    // いちばん新しい版には、項目に割り当てた工数と、人日単価をかけた金額を出す。
    expect(within(items).getByRole('row', { name: /請求の締めと締めの取消/ })).toHaveTextContent('￥800,00011 人日￥880,0001.5 人日￥120,000')
    const effort = screen.getByRole('region', { name: '工数' })
    expect(effort).toHaveTextContent('人手の工数66 人日・￥5,280,000（見積 -￥520,000）')
    expect(effort).toHaveTextContent('監査の工数7.5 人日・￥600,000')
    expect(effort).toHaveTextContent('未見積の工数（1）調整を登録する・人手の工数 3 人日・監査の工数 0.25 人日')
  })

  test('シナリオのページに、そのシナリオを指すいちばん新しい見積の項目を出す', async () => {
    await launchBrowser('/scenario/createSales')

    expect(screen.getByRole('region', { name: '見積（￥400,000）' })).toHaveTextContent('売上の登録￥400,000')
    expect(screen.getByRole('region', { name: '見積（￥400,000）' })).toHaveTextContent('売上を登録する（人手の工数 5 人日・監査の工数 0.5 人日）')
  })

  test('新しい業務フローのページから、置き換わる現行の業務フローへ移れる', async () => {
    const { user } = await launchBrowser('/flow/monthlyInvoice')

    const legacySection = screen.getByRole('region', { name: '現行の業務フロー' })
    await user.click(within(legacySection).getByRole('link', { name: '現行の月次の請求' }))
    expect(screen.getByRole('heading', { name: '現行の月次の請求' })).toBeVisible()
  })

  test('キャンバスのシナリオのカードに、そのシナリオと拡張に付いた課題を出す', async () => {
    const { user } = await launchBrowser('/')
    const frame = screen.getByRole('region', { name: '月次の請求' })

    await user.click(within(frame).getByRole('button', { name: '8 入金管理' }))
    await user.click(within(frame).getByRole('button', { name: '8.2 入金を記録する' }))
    const scenarioCard = within(frame).getByRole('article', { name: '入金を記録する' })
    await user.click(within(scenarioCard).getByRole('button', { name: /^課題/ }))
    expect(scenarioCard).toHaveTextContent('他社宛の誤入金を返金するとき、誰の承認が要るか')
    expect(scenarioCard).toHaveTextContent('他社宛の誤入金の返金は、承認者の承認を要する')
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
