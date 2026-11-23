// モックのサーバー（memoryServer.ts）と、画面に重ねる開発パネル（panel）でやり取りする形。
import type { EstimateItemNode, FlowNode, MeetingPlaceNode, PageNode, ScenarioNode } from '@app/translator/model-types'

/** モックの状態。サーバーが持ち、開発パネルへ渡す。 */
export type MockState = {
  /** DB に事前条件の行を入れた業務フロー。空の DB なら null。 */
  readonly flowName: string | null
  /** 今日を変えたときの、本当の時刻とのずれ（ミリ秒）。画面の時計をずらす（バックエンドは今日を読まない）。 */
  readonly clockOffset: number
}

/** モックだけの API。/api の下に置き、画面と同じく API サーバーへ中継される。 */
export const mockPaths = {
  state: '/api/mock/state',
  today: '/api/mock/today',
  model: '/api/mock/model',
} as const

/** 業務フローを選び直す（DB を事前条件の行で作り直す）。null なら空の DB。 */
export type StateRequest = { readonly flowName: string | null }

/** 今日を変える（YYYY-MM-DD の 9 時にする）。 */
export type TodayRequest = { readonly date: string }

/** 議事録で決めたこと（どの議事録で決めたかを添える）。 */
export type MockDecision = {
  readonly meetingId: string
  readonly date: string
  readonly meetingTitle: string
  readonly text: string
  readonly places: readonly MeetingPlaceNode[]
}

/** 議事録の課題（未解決なら resolved が false）。 */
export type MockQuestion = {
  readonly meetingId: string
  readonly meetingTitle: string
  readonly date: string
  readonly text: string
  readonly resolved: boolean
  readonly places: readonly MeetingPlaceNode[]
}

/** 見積の項目（どの見積の項目かを添える）。number は項目の番号、note は補足（区分・種類など）。なければ null。 */
export type MockEstimateItem = Pick<EstimateItemNode, 'title' | 'targets'> & {
  readonly number: number | null
  readonly note: string | null
  readonly estimateId: string
  readonly estimateTitle: string
}

/**
 * 開発パネルが読むモデル。コードのブラウザのモデル（@app/translator/model）から、画面・業務フロー・シナリオと、
 * それにつながる見積・議事録だけを抜き出す（処理・SQL・単語の表は送らない）。
 */
export type MockModel = {
  readonly flows: readonly FlowNode[]
  readonly scenarios: readonly Omit<ScenarioNode, 'cases'>[]
  readonly pages: readonly PageNode[]
  /** 処理（usecase）の名前。画面を開くシナリオが通る処理を、日本語で出すのに使う。 */
  readonly works: readonly { readonly id: string; readonly title: string }[]
  readonly estimateItems: readonly MockEstimateItem[]
  readonly decisions: readonly MockDecision[]
  readonly questions: readonly MockQuestion[]
}
