# web-app-framework

TypeScript（React + Hono）で業務 Web アプリを作るための土台（フレームワーク兼サンプル実装）。サンプルの業務は、売上の登録から、残高を繰り越す請求書の締め・発行、入金管理まで。

- 画面の操作から、API 通信を介さずにバックエンドの業務処理までを同じプロセスで結合テストする。差し替えるのは DB だけ。
- 識別子の英単語を単語帳で絞り、処理を日本語に機械翻訳して読めるようにする。
- 単語帳から画面の文言ファイル（日本語・英語）を生成し、画面・コード・設計の言葉をそろえる。
- 業務フローを TypeScript で書き、そのまま E2E として流す。コードのブラウザで、業務フローからシナリオ・処理・SQL までたどって読む。

まず読むもの: [このリポジトリの考え方](docs/concept.md)（業務フローからコードまでを一続きに読む、という全体の話）。

業務フロー・シナリオ・ケースの書き方は [docs/flow-rules.md](docs/flow-rules.md)。

要求と方針は [docs/requirements.md](docs/requirements.md)、業務の作りは [docs/domain-model.md](docs/domain-model.md)、単語帳の設計は [docs/vocabulary-design.md](docs/vocabulary-design.md)、処理の日本語訳は [docs/generated/backend-process.md](docs/generated/backend-process.md)、SQL の台帳は [docs/generated/sql-ledger.md](docs/generated/sql-ledger.md)。

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
| `pnpm translate` | 処理の日本語訳を作り直す |
| `pnpm sql:ledger` | SQL の台帳を作り直す（DB の名前の単語帳の検査も行う） |
| `pnpm flow:check` | 業務フローの書き方の規則を確かめる |
| `pnpm dev:browser` | コードのブラウザを開く（ソースを保存するたびにモデルを作り直す） |
| `pnpm dev:api` / `pnpm dev:web` | 手元で API サーバー（環境変数 `DATABASE_URL` が要る）と画面を動かす |
| `pnpm --filter @app/infra synth` | AWS の CloudFormation のテンプレートを作る（`-c stage=dev` などで環境を選ぶ） |

CI（`.github/workflows/check.yml`）は、main への push と Pull Request ごとに、`pnpm check`・DB の契約テスト・実ブラウザの E2E を流す。

## 構成

| 場所 | 内容 |
| --- | --- |
| `apps/web` | React の画面。`scenario` にシナリオとケース（画面の結合テスト）、`flow` に業務フロー（E2E） |
| `apps/browser` | コードのブラウザ（業務フロー・シナリオ・処理・SQL を読む） |
| `apps/server` | 本番の API サーバーとマイグレーションの実行（Dockerfile） |
| `packages/backend` | Hono の API（domain・usecase・repository・handler） |
| `packages/vocabulary` | 単語帳と、そこから作る辞書・文法・画面の文言ファイル |
| `packages/eslint-plugin` | 単語帳・関数名の文法・usecase の書き方の lint |
| `packages/flow` | 業務フロー・シナリオ・ケースの書き方と、画面の操作の部品 |
| `packages/translator` | 日本語翻訳ツール・SQL の台帳の生成・コードのブラウザのモデル（静的解析） |
| `infra` | AWS の CDK |
