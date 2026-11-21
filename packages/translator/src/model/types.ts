// コードのブラウザが読むモデル。ソースを静的解析して作る（手で書かない）。
// 業務フロー → 段 → シナリオ → ケース、シナリオ → 画面 → API の入口 → 処理（usecase）→ 規則（domain）・SQL → テーブル。

export type SourcePlace = { readonly file: string; readonly line: number }

export type ModelInput = { readonly label: string; readonly value: string }

/** 現行の業務フローの段の変わり方。同じ値の段（same）・置き換わる段（replaced）・なくなる段（discontinued）。 */
export type StepChange = 'same' | 'replaced' | 'discontinued'

/** 現行の段の置き換え先（新しい業務フローのシナリオ・システムの外の業務・業務フロー）。 */
export type ReplacementNode = { readonly kind: 'scenario' | 'step' | 'flow'; readonly id: string; readonly title: string }

export type FlowStepNode = SourcePlace & {
  /** フローの中の番号（1, 2, …）。子フローの中は、子フローの側で 1 から振る。 */
  readonly number: string
  /** legacy は旧システムの操作（現行の業務フローだけ）。 */
  readonly kind: 'operate' | 'outside' | 'occur' | 'elapse' | 'nest' | 'legacy'
  /** 段の日本語（「売上を登録する」「請求締め日になる」など）。 */
  readonly title: string
  readonly actor: string | null
  readonly actorTitle: string | null
  readonly scenarioId: string | null
  readonly flowId: string | null
  readonly inputs: readonly ModelInput[]
  readonly extensions: readonly FlowExtensionNode[]
  /** 段の値の鍵。apps/web/step の値なら「ファイル#名前」、時の経過なら「elapse:名詞」。現行と新しい業務フローで同じ段かを比べるのに使う。 */
  readonly stepKey: string | null
  /** 置き換え先・旧システムのテーブル・変わり方（現行の業務フローの段だけ）。 */
  readonly replacements: readonly ReplacementNode[]
  readonly tableIds: readonly string[]
  readonly change: StepChange | null
}

export type FlowExtensionNode = {
  /** 5a のような番号。 */
  readonly key: string
  readonly name: string
  readonly condition: string
  readonly inputs: readonly ModelInput[]
  readonly then: readonly FlowStepNode[]
  readonly resume: boolean
}

/** 役割（業務フローの担当・議事録の出席者・課題の担当）。 */
export type RoleNode = SourcePlace & {
  readonly id: string
  /** 定義した変数の名前（id と同じ）。 */
  readonly variable: string
  readonly title: string
  readonly side: 'vendor' | 'business' | 'external'
  readonly sideTitle: string
}

/**
 * 議事録の項目が話している場所。業務フロー（大きい粒度）・シナリオ・拡張（細かい粒度）と、
 * 画面（page）・処理（work）・規則（rule）、そのほかの関数（source）。
 */
export type MeetingPlaceNode = {
  readonly kind: 'flow' | 'scenario' | 'extension' | 'page' | 'work' | 'rule' | 'source' | 'legacy' | 'legacyTable'
  /** 指しているものの id（業務フロー・シナリオ・画面の道筋・処理・規則）。source なら「ファイル#名前」。 */
  readonly id: string
  /** 拡張の名前（extension のとき）。 */
  readonly extension: string | null
  readonly title: string
}

/** 決めたこと。前の回の課題を解決するなら、その課題を指す。 */
export type DecisionNode = {
  readonly places: readonly MeetingPlaceNode[]
  readonly text: string
  readonly questionId: string | null
}

/** 打合せの議事録。 */
export type MeetingNode = SourcePlace & {
  /** 変数の名前（meeting20261003）。 */
  readonly id: string
  readonly date: string
  readonly title: string
  readonly attendeeIds: readonly string[]
  readonly agenda: readonly MeetingPlaceNode[]
  readonly decisions: readonly DecisionNode[]
  /** この回で挙がった課題。 */
  readonly questionIds: readonly string[]
}

/** 課題。解決したかどうかは、後の回でその課題を指して決めたことから求める。 */
export type QuestionNode = SourcePlace & {
  /** 挙げた議事録と課題の名前（meeting20261003.overpaymentHandling）。 */
  readonly id: string
  readonly key: string
  readonly meetingId: string
  /** 挙げた打合せの日。 */
  readonly date: string
  readonly places: readonly MeetingPlaceNode[]
  readonly text: string
  readonly assigneeId: string
  readonly deadline: string
  /** 解決した決定（後の回の議事録・日・決めたこと）。まだなら null。 */
  readonly decision: { readonly meetingId: string; readonly date: string; readonly text: string } | null
}

export type FlowNode = SourcePlace & {
  readonly id: string
  readonly title: string
  /** 業務の領域（apps/web/flow/<領域>/ のフォルダの名前。invoice など）と、その日本語（請求）。 */
  readonly area: string
  readonly areaTitle: string
  readonly precondition: string | null
  readonly steps: readonly FlowStepNode[]
  /** この業務フローを子フローにしている業務フロー。 */
  readonly parentIds: readonly string[]
  /** この業務フローに置き換わる、現行の業務フロー。 */
  readonly legacyIds: readonly string[]
}

/** 新しい業務フローにあって、現行の業務フローのどの段からも指されていない段（新しい業務）。 */
export type AddedStepNode = { readonly number: string; readonly kind: FlowStepNode['kind']; readonly title: string; readonly scenarioId: string | null }

/** 現行（AsIs）の業務フロー。 */
export type LegacyFlowNode = FlowNode & {
  /** 置き換え先の新しい業務フロー。なければ、この業務はなくなる。 */
  readonly replacementIds: readonly string[]
  readonly addedSteps: readonly AddedStepNode[]
}

export type LegacyColumnNode = {
  readonly name: string
  readonly title: string
  readonly type: string
  readonly note: string
  /** 移す先の新しいテーブルの列。 */
  readonly replacement: { readonly tableId: string; readonly column: string } | null
}

/** 旧システムのテーブル。 */
export type LegacyTableNode = SourcePlace & {
  /** 定義した変数の名前。 */
  readonly id: string
  /** 旧システムでの名前（物理名）。 */
  readonly name: string
  readonly title: string
  readonly note: string
  readonly columns: readonly LegacyColumnNode[]
}

export type CaseNode = SourcePlace & {
  readonly kind: 'main' | 'vary' | 'extend'
  readonly extension: string | null
  readonly title: string
  readonly pending: boolean
  /** each で書いたケースの行（値の表）。 */
  readonly rows: readonly Readonly<Record<string, string>>[]
  /** ケースの中身の日本語の手順。 */
  readonly steps: readonly string[]
}

export type ScenarioExtensionNode = {
  readonly name: string
  readonly condition: string
  /** 扱い（シナリオに書いた confirm の日本語）。なければ null。 */
  readonly handling: readonly string[] | null
  /** この拡張のケースの数と、この拡張を流す業務フローの経路。 */
  readonly caseCount: number
  readonly flowPaths: readonly string[]
  readonly pending: boolean
}

export type ScenarioUse = { readonly flowId: string; readonly number: string }

export type ScenarioNode = SourcePlace & {
  readonly id: string
  readonly title: string
  readonly actor: string
  readonly actorTitle: string
  readonly pending: boolean
  readonly steps: readonly string[]
  readonly guarantee: readonly string[]
  readonly extensions: readonly ScenarioExtensionNode[]
  readonly cases: readonly CaseNode[]
  readonly testFile: string | null
  readonly usedIn: readonly ScenarioUse[]
  /** 手順で開く画面（道筋）。 */
  readonly pageIds: readonly string[]
  /** 手順で押すボタンから呼ぶ API の入口。 */
  readonly actionEndpointIds: readonly string[]
  /** 開いた画面が読み込む API の入口。 */
  readonly queryEndpointIds: readonly string[]
  /** 押すボタン・開く画面から通る処理（usecase）。 */
  readonly workIds: readonly string[]
}

export type PageActionNode = { readonly button: string; readonly endpointIds: readonly string[] }

export type PageNode = SourcePlace & {
  /** 道筋（/payments/new など）。 */
  readonly id: string
  readonly title: string
  readonly component: string
  readonly queryEndpointIds: readonly string[]
  readonly actions: readonly PageActionNode[]
  readonly links: readonly { readonly to: string; readonly inTable: boolean }[]
}

export type EndpointNode = SourcePlace & {
  /** POST /api/payments のような形。 */
  readonly id: string
  readonly method: string
  readonly path: string
  readonly workIds: readonly string[]
}

export type StepTranslationNode = { readonly text: string; readonly children: readonly StepTranslationNode[] }

export type RepositoryCallNode = { readonly repository: string; readonly method: string; readonly title: string; readonly statementIds: readonly string[] }

export type WorkNode = SourcePlace & {
  readonly id: string
  readonly title: string
  readonly steps: readonly StepTranslationNode[]
  readonly ruleIds: readonly string[]
  readonly repositoryCalls: readonly RepositoryCallNode[]
  readonly endpointIds: readonly string[]
}

export type RuleNode = SourcePlace & {
  readonly id: string
  readonly name: string
  readonly title: string
  readonly steps: readonly StepTranslationNode[]
}

export type StatementNode = SourcePlace & {
  readonly id: string
  readonly text: string
  readonly tableIds: readonly string[]
}

export type ColumnNode = { readonly name: string; readonly title: string; readonly type: string; readonly note: string }

export type TableNode = SourcePlace & {
  readonly id: string
  readonly title: string
  readonly note: string
  readonly columns: readonly ColumnNode[]
  readonly statementIds: readonly string[]
}

export type GlossaryEntry = {
  readonly id: string
  readonly category: string
  readonly japanese: string
  readonly english: string
  readonly description: string
}

export type ModelProblem = SourcePlace & { readonly rule: string; readonly message: string }

export type ModelProgress = {
  readonly flows: number
  readonly flowSteps: number
  readonly scenarios: number
  readonly pendingScenarios: number
  readonly extensions: number
  readonly pendingExtensions: number
  readonly cases: number
  readonly pendingCases: number
  /** 議事録の数。 */
  readonly meetings: number
  /** 課題の数と、そのうちまだ解決していないもの（0 になれば、要件定義で決めることは残っていない）。 */
  readonly questions: number
  readonly openQuestions: number
  /** 現行の業務フローと旧システムのテーブルの数。 */
  readonly legacyFlows: number
  readonly legacyTables: number
}

export type Model = {
  /** 見出し・手順の言語。 */
  readonly locale: 'ja' | 'en'
  readonly roles: readonly RoleNode[]
  readonly meetings: readonly MeetingNode[]
  readonly questions: readonly QuestionNode[]
  readonly flows: readonly FlowNode[]
  readonly legacyFlows: readonly LegacyFlowNode[]
  readonly legacyTables: readonly LegacyTableNode[]
  readonly scenarios: readonly ScenarioNode[]
  readonly pages: readonly PageNode[]
  readonly endpoints: readonly EndpointNode[]
  readonly works: readonly WorkNode[]
  readonly rules: readonly RuleNode[]
  readonly statements: readonly StatementNode[]
  readonly tables: readonly TableNode[]
  readonly glossary: readonly GlossaryEntry[]
  readonly problems: readonly ModelProblem[]
  readonly progress: ModelProgress
}
