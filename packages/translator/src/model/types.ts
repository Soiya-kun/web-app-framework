// コードのブラウザが読むモデル。ソースを静的解析して作る（手で書かない）。
// 業務フロー → 段 → シナリオ → ケース、シナリオ → 画面 → API の入口 → 処理（usecase）→ 規則（domain）・SQL → テーブル。

export type SourcePlace = { readonly file: string; readonly line: number }

export type ModelInput = { readonly label: string; readonly value: string }

export type FlowStepNode = SourcePlace & {
  /** フローの中の番号（1, 2, …）。子フローの中は、子フローの側で 1 から振る。 */
  readonly number: string
  readonly kind: 'operate' | 'outside' | 'occur' | 'elapse' | 'nest'
  /** 段の日本語（「売上を登録する」「請求締め日になる」など）。 */
  readonly title: string
  readonly actor: string | null
  readonly actorTitle: string | null
  readonly scenarioId: string | null
  readonly flowId: string | null
  readonly inputs: readonly ModelInput[]
  readonly extensions: readonly FlowExtensionNode[]
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
}

export type Model = {
  /** 見出し・手順の言語。 */
  readonly locale: 'ja' | 'en'
  readonly flows: readonly FlowNode[]
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
