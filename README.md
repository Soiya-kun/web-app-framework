# web-app-framework

TypeScript（React + Hono）で業務 Web アプリを作るための土台（フレームワーク兼サンプル実装）。サンプルの業務は、売上の登録から、残高を繰り越す請求書の締め・発行、入金管理まで。

- 画面の操作から、API 通信を介さずにバックエンドの業務処理までを同じプロセスで結合テストする。差し替えるのは DB だけ。
- 識別子の英単語を単語帳で絞り、処理を日本語に機械翻訳して読めるようにする。
- 単語帳の単語を画面の文言にも使う。

要求と方針は [docs/requirements.md](docs/requirements.md)、業務の作りは [docs/domain-model.md](docs/domain-model.md)、処理の日本語訳は [docs/generated/backend-process.md](docs/generated/backend-process.md)、SQL の台帳は [docs/generated/sql-ledger.md](docs/generated/sql-ledger.md)。

## 使い方

Node.js（`.node-version`）と pnpm（`package.json` の `packageManager`）を用意し、ルートで実行する。DB を使うテストには Docker が要る。

| コマンド | 内容 |
| --- | --- |
| `pnpm install` | 依存を入れる |
| `pnpm check` | 単語帳の生成物・lint・型・テスト・翻訳の生成物をまとめて確かめる |
| `pnpm test` | テストだけ（Docker は要らない） |
| `pnpm test:database` | Docker の PostgreSQL を起動し、repository のテストを流す |
| `pnpm vocabulary:generate` | 単語帳（`packages/vocabulary/words` など）を変えたあとに辞書を作り直す |
| `pnpm translate` | 処理の日本語訳を作り直す |
| `pnpm sql:ledger` | SQL の台帳を作り直す |
| `pnpm dev:api` / `pnpm dev:web` | 手元で API サーバー（環境変数 `DATABASE_URL` が要る）と画面を動かす |
| `pnpm --filter @app/infra synth` | AWS の CloudFormation のテンプレートを作る（`-c stage=dev` などで環境を選ぶ） |

## 構成

| 場所 | 内容 |
| --- | --- |
| `apps/web` | React の画面と、画面の結合テスト |
| `apps/server` | 本番の API サーバーとマイグレーションの実行（Dockerfile） |
| `packages/backend` | Hono の API（domain・usecase・repository・handler） |
| `packages/vocabulary` | 単語帳と、そこから作る辞書・文法・画面の文言 |
| `packages/eslint-plugin` | 単語帳・関数名の文法・usecase の書き方の lint |
| `packages/translator` | 日本語翻訳ツールと SQL の台帳の生成 |
| `infra` | AWS の CDK |
