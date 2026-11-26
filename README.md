# web-app-framework

TypeScript（React + Hono）で業務 Web アプリを作るための土台（フレームワーク兼サンプル実装）。サンプルの業務は、売上の登録から、残高を繰り越す請求書の締め・発行、入金管理まで。

- 画面の操作から、API 通信を介さずにバックエンドの業務処理までを同じプロセスで結合テストする。差し替えるのは DB だけ。
- 識別子の英単語を単語帳で絞り、処理を日本語に機械翻訳して読めるようにする。
- 単語帳から画面の文言ファイル（日本語・英語）を生成し、画面・コード・設計の言葉をそろえる。
- 業務フローを TypeScript で書き、そのまま E2E として流す。コードのブラウザで、業務フローからシナリオ・処理・SQL までたどって読む。
- 受託開発の要件定義のために、役割と議事録も TypeScript で書く。話したことは決めたことか課題にし、業務フロー・画面・処理に型でつなぐ。先方はブラウザで業務フローと議事録を確かめる。
- 現行（AsIs）の業務フローと旧システムのテーブルも TypeScript で書き、新しい業務フロー（ToBe）への置き換えを型で持つ。同じ・置き換え・廃止・新しい段を比べて見られる。
- 見積も TypeScript で取り込み（任意）、項目から現行・新しい業務フロー・機能まで追える。見積にないシナリオも数える。機能ごとの工数（監査の工数・人手の工数）も持て、要件が固まったあとの新しいシステムの金額を元の見積と比べられる。
- IPA「機能要件の合意形成ガイド 画面編」の設計書（画面一覧・画面遷移・画面レイアウト・画面入出力項目一覧・画面アクション明細・共通ルール）を、画面の部品と画面遷移のテストから静的解析で作り、ブラウザで見せる。

まず読むもの: [このリポジトリの考え方](docs/concept.md)（業務フローからコードまでを一続きに読む、という全体の話）。

業務フロー・シナリオ・ケース・画面遷移のテスト・役割・議事録・現行の業務フロー・見積の書き方は [docs/flow-rules.md](docs/flow-rules.md)。

要件定義は、「開発チームがヒアリング・提案する → 先方が返事をする → 文字起こしやメモから AI が議事録を作って PR にする → 開発チームと先方でレビューしてマージする」のサイクルで会話すればよい。未解決の課題がなくなれば、決めることは残っていない（[docs/flow-rules.md の 7.3](docs/flow-rules.md#73-要件定義の進め方--このサイクルで会話すればよい)）。AI に向けた指示は、議事録を作る Skill（`.claude/skills/minutes`）の1つだけで、ほかの決まりはすべて CI で止める。

要求と方針は [docs/requirements.md](docs/requirements.md)、業務の作りは [docs/domain-model.md](docs/domain-model.md)、単語帳の設計は [docs/vocabulary-design.md](docs/vocabulary-design.md)、処理の訳は [docs/generated/backend-process.md](docs/generated/backend-process.md)（英語は [backend-process.en.md](docs/generated/backend-process.en.md)）、SQL の台帳は [docs/generated/sql-ledger.md](docs/generated/sql-ledger.md)。

## 使い方

Node.js（`.node-version`）と pnpm（`package.json` の `packageManager`）を用意し、ルートで実行する。DB を使うテストには Docker が要る。

| コマンド | 内容 |
| --- | --- |
| `pnpm install` | 依存を入れる |
| `pnpm check` | 単語帳の生成物・lint・型・テスト・翻訳と SQL の台帳の生成物・業務フローの書き方をまとめて確かめる |
| `pnpm test` | テストだけ（Docker は要らない） |
| `pnpm test:database` | Docker の PostgreSQL を起動し、repository のテストを流す |
| `pnpm test:e2e` | Docker の PostgreSQL を起動し、業務フローを実ブラウザ（Chromium）・API サーバーで流す |
| `pnpm vocabulary:generate` | 単語帳（`packages/vocabulary/words` など）を変えたあとに、辞書と画面の文言ファイルを作り直す |
| `pnpm vocabulary:find <日本語>` | 日本語の用語から英語の名前を引く（`振込依頼人の顧客` → `payerCustomer`） |
| `pnpm translate` | 処理の訳（日本語・英語）を作り直す |
| `pnpm sql:ledger` | SQL の台帳を作り直す（DB の名前の単語帳の検査も行う） |
| `pnpm flow:check` | 業務フローの書き方の規則を確かめる |
| `pnpm dev:browser` | コードのブラウザを開く（http://localhost:5199。ソースを保存するたびにモデルを作り直す）。業務フローの段の「モックで開く」で、モックの画面をその段の手前まで流して開く |
| `pnpm dev:api` / `pnpm dev:web` | 手元で API サーバー（環境変数 `DATABASE_URL` が要る）と画面を動かす |
| `pnpm dev:mock [業務フローの名前]` | Docker も DB も使わずに、画面をモック（メモリの DB。http://localhost:5173）で動かす（例 `pnpm dev:mock paymentManagement`）。DB には選んだ業務フローの事前条件の行が入る。画面の右の開発パネルで業務フローを選び直し、段を「ここまで進める」（前の段を画面で自動で流す）・「見せる」（操作する欄を光らせてゆっくり流す）・「入れるだけ」（最後のボタンは押さない）。いまの画面を開くシナリオ・処理・見積の項目・議事録を出し、コードのブラウザへリンクする。最初のページと Ctrl+K で画面の一覧（領域ごと・テストのない画面・見た印とメモ）を開く |
| `pnpm --filter @app/infra synth` | AWS の CloudFormation のテンプレートを作る（`-c stage=dev` などで環境を選ぶ） |

CI（`.github/workflows/check.yml`）は、main への push と Pull Request ごとに、`pnpm check`・DB の契約テスト・実ブラウザの E2E を流す。

## 構成

| 場所 | 内容 |
| --- | --- |
| `apps/web` | React の画面。`scenario` にシナリオとケース（画面の結合テスト）、`flow` に業務フロー（E2E）、`role` に役割、`step` にシステムの外の業務の値、`meeting` に議事録、`legacy` に現行の業務フローと旧システムのテーブル、`estimate` に見積、`effort` に機能ごとの工数、`transition` に画面遷移のテスト |
| `apps/browser` | コードのブラウザ（業務フロー・シナリオ・処理・SQL・議事録・現行の業務フロー・見積・画面の設計書を読む） |
| `apps/server` | 本番の API サーバーとマイグレーションの実行（Dockerfile） |
| `packages/backend` | Hono の API（domain・usecase・repository・handler） |
| `packages/vocabulary` | 単語帳と、そこから作る辞書・文法・画面の文言ファイル |
| `packages/eslint-plugin` | 単語帳・関数名の文法・usecase の書き方の lint |
| `packages/flow` | 業務フロー・シナリオ・ケース・画面遷移のテスト・役割・議事録・現行の業務フロー・見積の書き方と、画面の操作の部品 |
| `packages/translator` | 日本語翻訳ツール・SQL の台帳の生成・コードのブラウザのモデル（静的解析） |
| `infra` | AWS の CDK |
| `.claude/skills/minutes` | 文字起こしから議事録を作る Skill。AI に向けた指示はこれ1つだけで、ほかの決まりは CI で止める |
