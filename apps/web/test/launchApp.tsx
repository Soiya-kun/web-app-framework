import type { Screen } from '@app/flow'
import { prepareTestingScreen } from '@app/flow/testing'
import { prepareMemoryDatabase, type MemoryDatabase } from '@app/backend/testing'
import { prepareText } from '@app/vocabulary/text'
import { displayYen } from '../src/shared/yen'
import { renderScreen } from './renderScreen'

export type LaunchedApp = {
  readonly screen: Screen
  readonly database: MemoryDatabase
}

/**
 * 画面を最初のページ（請求一覧）から開き、シナリオの操作の言い方（Screen）で動かせるようにする。
 * バックエンドは同じプロセスで動き、DB はモック DB（seed の行を入れておく）。
 */
export async function launchApp(seed: Partial<MemoryDatabase> = {}): Promise<LaunchedApp> {
  const database = prepareMemoryDatabase(seed)
  const { user } = await renderScreen('/', database)
  const screen = prepareTestingScreen({ user, text: prepareText('ja'), formatAmount: (amount) => displayYen('ja', amount) })
  return { screen, database }
}
