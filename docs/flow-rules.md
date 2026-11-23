# 業務フローの書き方の規則

業務フロー・シナリオ・ケース・役割・議事録・現行の業務フロー・見積の書き方と、その検査の規則をまとめる。なぜこの形にしたかは [このリポジトリの考え方](concept.md) の6章にある。

書いた時点: 2026-11-21。規則は `pnpm flow:check`（`pnpm check` に含まれる）が検査する。

## 1. 全体の形

業務フローは、コーバーン『ユースケース実践ガイド』の目的のレベルに合わせて、4つの階層で書く。

| 階層 | コーバーンのレベル | 書く場所 | 書くもの | テストとしての動き |
| --- | --- | --- | --- | --- |
| 業務フロー | 要約 | `apps/web/flow/<領域>/<名前>.ts` | `defineFlow`: 段の並び | 本線と拡張ごとの経路を E2E として流す（`apps/web/flow/flow.test.tsx`） |
| シナリオ | 利用者の目的 | `apps/web/scenario/<領域>/<名前>.ts` | `defineScenario`: 主アクター・手順・成功の保証・拡張 | ケースと業務フローから使う |
| ケース | 拡張・バリエーション | `apps/web/scenario/<領域>/<名前>.test.tsx` | `describeScenario`: 主成功シナリオ・バリエーション・拡張 | 画面の結合テスト |
| 処理 | 下位機能 | `packages/backend/src/usecase` | usecase の関数（[4章](concept.md#4-コードの書き方--機械で読める形に絞る)） | ケース・業務フローから、画面を通って動く |

どの階層も、インプロセス（ブラウザ・サーバー・DB を起動しない）で動く。業務フロー「月次の請求」の本線は約 0.45 秒で流れる。

## 2. 業務フロー

```ts
/** 月ごとに売上を請求にまとめて発行し、入金で残高を減らして、次の月の請求へ繰り越す（最上位の業務フロー）。 */
export const monthlyInvoice = defineFlow<Partial<MemoryDatabase>>('monthlyInvoice', {
  precondition: { summary: '親会社と、請求先を親会社にした子会社が、顧客として登録されている', seed: { customer: customers } },
  steps: [
    deliverProduct,                                              // システムの外の業務（apps/web/step の値）
    operate(createSales, { customer: '株式会社子', salesDate: '2026-10-15', salesKind: '通常', itemName: '運賃', salesAmount: '100000', taxRate: '10%' }),
    elapse('closingDate', '2026-10-31'),
    operate(closeInvoice, { ...october, breakdown: { currentSalesAmount: 100_000, taxAmount: 10_000, currentInvoiceAmount: 110_000 } }),
    operate(browseInvoice, october, {
      mistakenInvoice: { input: october, then: [operate(cancelClosing, october), …], resume: false },
    }),
    operate(issueInvoice, { ...october, issueDate: '2026-11-02' }),
    sendInvoice,
    nest(paymentManagement),
    elapse('closingDate', '2026-11-30'),
    operate(closeInvoice, { … }),
  ],
})
```

### 2.1 規則

- 名前は**名詞句**で、単語帳の言葉だけで書く（`monthlyInvoice` →「月次の請求」）。変数の名前と同じにする。
- `precondition` に、事前条件を日本語（`summary`）と、テストで最初に入れておく行（`seed`）で書く。子フローとして使うときは、親の事前条件だけを使う。
- 段は次の5種類だけにする。

| 段 | 書き方 | 意味 | テストで流すとき |
| --- | --- | --- | --- |
| 画面の操作 | `operate(シナリオ, 値, 拡張)` | 1人が画面で目的を果たす | シナリオの手順と成功の保証を流す |
| システムの外の業務 | `apps/web/step` に `outside(担当, 動詞で始まる名前)` で書いた値 | 商品を納品する・請求書を送るなど | 何もしない（流れ図に出す） |
| 外のイベント | `apps/web/step` に `occur(担当, 動詞で始まる名前)` で書いた値 | 顧客が請求を支払うなど | 何もしない（必要ならデータを作る段にする） |
| 時の経過 | `elapse(名詞, 'YYYY-MM-DD')` | 締め日になるなど | テストの今日の日付をその日にする |
| 子フロー | `nest(業務フロー)` | 別の業務フローをひとまとまりで入れる | 子フローの段を、その場で流す |

- 担当は、`apps/web/role` に書いた役割の値で渡す（`salesperson` 営業担当・`accountant` 経理担当・`customer` 顧客。[7章](#7-受託開発の要件定義)）。シナリオの担当はシナリオの側に書く。
- システムの外の業務と外のイベントは、`apps/web/step/step.ts` に1つずつ値として書き（`export const deliverProduct = outside(salesperson, 'deliverProduct')`、変数の名前は段の名前と同じ）、業務フローではその値を段にする。同じ業務は、どの業務フローでも（現行の業務フローでも）同じ値になる。
- 段の番号は、上から 1, 2, … と振る。子フローの中は「親の番号.子の番号」（8.2）。

### 2.2 拡張（うまくいかない流れ）

- 拡張は、画面の操作の段にだけ付ける。キーは、そのシナリオの `extensions` に書いた名前にする（型で検査される）。
- `input` はその条件のときに入れる値、`then` はそのあとに続く段。
- 拡張の経路は、その段の代わりに拡張の段を流し、**本線の次の段へ戻る**。戻すと後の段の値が合わなくなるとき（締め直して請求額が変わるなど）は `resume: false` にして、その経路をそこで終える。
- 拡張の番号は「段の番号＋a, b, …」（5a、子フローの中は 8.2a）。テストの経路の名前にもなる。
- 分岐はこれだけにする。BPMN のような汎用の記法は作らない。繰り返し（次の月）は、段を書き並べて表す。

### 2.3 未着手

- 中身を書いていないシナリオを段にしてよい（未着手）。未着手のシナリオには値を渡さない（`operate(createSales)`）。
- シナリオに手順を書くと、値が要るようになり、業務フローの段が型のエラーになる。業務フローに値を書くまで、検査が通らない。
- 業務フローの E2E は、未着手のシナリオの手前まで流して skip になる（テストの結果に「未着手のシナリオ」と出る）。

## 3. シナリオ

```ts
export const registerPayment = defineScenario('registerPayment', {
  actor: accountant,
  operate: async (screen, payment: PaymentInput) => {
    await screen.go('paymentCreate')
    await screen.fill('paymentDate', payment.paymentDate)
    await screen.fill('paymentAmount', payment.paymentAmount)
    await screen.fill('payerName', payment.payerName)
    await screen.choose('customer', payment.customer)
    await screen.press('register')
  },
  confirm: async (screen, payment) => {
    await screen.expectMessage('paymentIdentified', { customer: payment.customer })
  },
  extensions: {
    unidentifiedPayer: {
      condition: '振込依頼人名から顧客を特定できない',
      confirm: async (screen) => {
        await screen.expectMessage('unidentifiedPayment')
      },
    },
    invalidPaymentAmount: { condition: '入金額が空か、1 から 999,999,999 の整数でない' },
  },
})
```

### 3.1 規則

- 名前は**動詞で始める**（`registerPayment` →「入金を記録する」）。単語帳の言葉だけで書き、変数の名前と同じにする。
- 1つのシナリオは、**1人が1回の操作で果たす目的**にする（コーバーンの「利用者の目的」。済んだらコーヒーを飲みに行ける大きさ）。
- `actor` に主アクターを、役割の値で書く。
- `operate`（主成功シナリオの手順）は、**画面を開く（`screen.go`）ところから始める**。前のシナリオの画面に頼らない。
- `operate` と `confirm` には、画面の操作（`await screen.…`）を並べるだけにする。`if`・繰り返し・計算は書かない（usecase と同じく、手順の並びのまま日本語に訳すため）。
- `confirm` に、成功の保証（うまくいったときに画面で確かめること）を書く。
- 値の型（`PaymentInput` など）は、画面に入れる値を、画面に出る名前で持つ（選択肢は表示の名前「通常」「8%（軽減）」）。
- `extensions` に拡張を書く。キーは単語帳の言葉、`condition` は「何が起きたか」の日本語。`confirm` は扱い（そのとき確かめること）で、業務フローの拡張の経路で使う。書かなければ、扱いはケースに書く。

### 3.2 画面の操作の言い方（Screen）

画面の要素は、利用者と同じく、ラベル・ボタン・見出しの名前で指す。名前は単語帳のキーで書き、画面にない文言のキーは型のエラーになる。

| 操作 | 意味 | ブラウザでの日本語 |
| --- | --- | --- |
| `go(見出し)` | 画面の上のナビゲーションから開く | 「入金登録」を開く |
| `follow(文字)` | 画面の中のリンクをたどる | 「2026-10-31」のリンクをたどる |
| `fill(項目, 値)` | 入力欄に入れる（前の値は消す） | 入金日に〈入金日〉を入れる |
| `choose(項目, 表示の名前)` | 選択肢を選ぶ（空なら未選択に戻す） | 顧客で〈顧客〉を選ぶ |
| `press(ボタン)` | ボタンを押す | 「記録」を押す |
| `row(文字, …)` | 表の、その文字をすべて含む1行の中だけを操作する | 〈振込依頼人名〉の行で、… |
| `rowOf(表, { 列: 値 })` | 表の、列ごとの値がすべて合う1行の中だけを操作する。ほかの列に同じ文字がある行（前の請求の入金期日が、この請求の請求締め日と同じなど）と取り違えない | 「請求一覧」の、請求締め日が〈請求締め日〉・請求先が〈請求先〉の行で、… |
| `expectMessage(文, 値)` | 知らせの文が出ている | 「…」と出ることを確かめる |
| `expectAlert(文, 値)` | 警告の文が出ている | 警告「…」が出ることを確かめる |
| `expectProblem(項目, 文, 値)` | 項目の下に問題の文が出ている | 入金額に「…」と出ることを確かめる |
| `expectHeading(見出し)` | その画面に移った | 「請求詳細」の画面になったことを確かめる |
| `expectCells(表, { 列: 値 })` | 表の1行目の値（数は金額として円の表示と比べる） | 「請求の内訳」の1行目が、…であることを確かめる |
| `expectRows(表, 行)` | 表の全ての行 | 「請求の内訳」の行を確かめる |
| `expectText(文字)` / `expectNoButton(ボタン)` / `expectOptions(項目, 選択肢)` | 文字が出ている／ボタンが出ていない／選択肢の並び | — |

インプロセスのテストでは Testing Library で動かす（`@app/flow/testing`）。同じシナリオを、実ブラウザでは Playwright で動かす（`@app/flow/playwright`、`pnpm test:e2e`）。シナリオの中身は変えない。

## 4. ケース

```tsx
describeScenario(registerPayment, (cases) => {
  cases.main('顧客を選んで記録すると、その顧客の入金にし、振込依頼人名を覚える', async () => {
    const app = await launchApp({ customer: customers })
    await operateScenario(registerPayment, app.screen, validPayment)

    await confirmScenario(registerPayment, app.screen, validPayment)
    expect(app.database.payerName).toEqual([{ payerName: 'カ)オヤ', customerId: 'customer-0001' }])
  })

  cases.vary('顧客を選ばなければ、覚えた振込依頼人名から顧客を特定する', async () => { … })

  cases.extendEach('invalidPaymentAmount', [{ paymentAmount: '0', messageKey: 'invalidRange' }, …] as const, '入金額「$paymentAmount」は「$messageKey」で止める', async ({ paymentAmount, messageKey }) => {
    const app = await registerOnScreen({ ...validPayment, paymentAmount })

    await app.screen.expectProblem('paymentAmount', messageKey, { minimum: 1, maximum: 999_999_999 })
    expect(app.database.payment).toEqual([])
  })

  cases.extend('invalidPaymentDate', '実在しない入金日は止める')   // 中身がなければ未着手（todo）
})
```

### 4.1 規則

- ケースのファイルは、シナリオのファイルの隣に、同じ名前で置く（`registerPayment.ts` → `registerPayment.test.tsx`）。
- ファイルには `describeScenario` だけを書く。`describe`・`test` を直接書かない。
- ケースは3種類にする（コーバーンの書式に合わせる）。

| 書き方 | 種類 | 書くもの |
| --- | --- | --- |
| `cases.main(見出し, 中身)` | 主成功シナリオ | シナリオに1つだけ。`operateScenario` と `confirmScenario` を流し、保存した行を確かめる |
| `cases.vary(見出し, 中身)`・`cases.varyEach(行, 見出し, 中身)` | 技術とデータのバリエーション | うまくいく範囲での入力の違い（返品・軽減税率・境界の内側の値） |
| `cases.extend(拡張, 見出し, 中身)`・`cases.extendEach(拡張, 行, 見出し, 中身)` | 拡張 | シナリオに書いた拡張の条件のとき、画面に何が出て、何を保存しないか（最低限の保証） |

- 見出しは日本語で、何を確かめるかが読めるように書く。`…Each` の見出しには `$列名` で行の値を入れられる。
- 中身（関数）を書かなければ未着手（vitest の todo）になる。
- 画面は `launchApp(行)` で開く（請求一覧から始まり、モック DB にその行を入れておく）。シナリオの手順は `operateScenario`、成功の保証は `confirmScenario`、拡張の扱いは `confirmExtension` で流す。
- 境界値はケースで厚く確かめる。止めたときは「何も保存していない」ことまで確かめる。

## 5. ヒアリングから育てる段階

| 段階 | コーバーンの精度 | 書くもの | ブラウザの見え方 |
| --- | --- | --- | --- |
| 1 | 主アクターと目的 | 業務フローの段と、名前と担当だけのシナリオ（`defineScenario('createSales', { actor: salesperson })`） | 担当ごとのレーン図。シナリオはすべて未着手 |
| 2 | 主成功シナリオ | シナリオの `operate`・`confirm`、業務フローの段の値、主成功シナリオのケース | 手順と成功の保証。業務フローの E2E が先へ進む |
| 3 | 拡張の条件 | シナリオの `extensions`（`condition` だけ） | 拡張の一覧。扱いのない拡張は未着手 |
| 4 | 拡張の扱い | 拡張のケース、業務フローの拡張の経路 | ケースの手順と、テストの経路 |

段の名前は、日本語で決めてから `pnpm vocabulary:find 売上を登録する` のように英語の名前を引く。単語帳にない言葉は、そのときに単語帳に足す（業務の言葉は説明を付ける）。

## 6. 検査（pnpm flow:check）

静的解析で次を確かめ、1つでもあれば止める（ブラウザの「規則の問題」にも出す）。未着手の数は止めずに数える。

| 規則 | 内容 |
| --- | --- |
| `flow-name` | 業務フローの名前は、変数と同じ・単語帳の言葉・名詞句 |
| `flow-step` | 段は `operate`・`outside`・`occur`・`elapse`・`nest` の呼び出しで、シナリオ・業務フローを import で渡す |
| `flow-cycle` | 子フローをたどって、自分を含まない |
| `flow-place` | 業務フローは `apps/web/flow/<領域>/` に置く。領域（`invoice`・`payment` など）は単語帳の名詞で、ブラウザのまとまりになる |
| `step-name` | システムの外の業務・外のイベントの名前は動詞で始め、担当は役割の値。`apps/web/step` の値の変数の名前は、段の名前と同じ |
| `step-place` | 業務フローのシステムの外の業務・外のイベントは、`apps/web/step` に書いた値を使う。`apps/web/step` の値に置き換え先は書かない |
| `elapse` | 時の経過は単語帳の名詞と、YYYY-MM-DD の日付 |
| `scenario-form`・`scenario-name`・`actor` | シナリオは `defineScenario(名前, { actor, … })`。名前は変数と同じ・単語帳の言葉・動詞で始める。担当は役割の値 |
| `scenario-start` | 手順は画面を開く（`screen.go`）ところから始める |
| `scenario-flat` | 手順と成功の保証は、画面の操作を並べるだけ |
| `scenario-orphan` | シナリオは、どれかの業務フローの段（拡張の段を含む）になっている |
| `extension-name` | 拡張のキーは単語帳の言葉 |
| `case-place` | ケースはシナリオの隣の `.test.tsx` に、`describeScenario` だけで書く |
| `case-main` | 主成功シナリオのケースは1つ |
| `case-extension` | 拡張のケースは、シナリオにある拡張を指す |
| `test-place` | `apps/web` の画面のテストは、`scenario` と `flow` にだけ置く（`e2e` は同じ業務フローを実ブラウザで流すだけ、`mock` は同じ業務フローをモックの開発パネルで流す道具のテスト） |
| `role` | 役割は `apps/web/role` に `defineRole(名前, { side })` で書く。名前は変数と同じ・単語帳の名詞、立場は `vendor`・`business`・`external` |
| `meeting` | 議事録は `defineMeeting('YYYY-MM-DD', { … })` で、変数の名前は `meeting` と日付 |
| `meeting-place` | 議題・決めたこと・課題は、業務フロー・シナリオ・`extensionOf(シナリオ, 拡張)`・関数を、ファイルから import して指す |
| `meeting-role` | 出席者・課題の担当は、役割の値を import して渡す |
| `question-name`・`question-deadline` | 課題の名前は単語帳の言葉。期限は YYYY-MM-DD で、打合せの日以後 |
| `decision-question` | 課題を解決する決定は `{ question: 議事録.questions.課題の名前 }` の形で、課題を挙げた打合せより後の打合せで1回だけ |
| `legacy-name`・`legacy-place` | 現行の業務フローは `apps/web/legacy/<領域>/` に `defineLegacyFlow(名前, { replacement, steps })` で書く。名前は変数と同じ・単語帳の言葉・名詞句で、`legacy` で始める |
| `legacy-step` | 現行の業務フローに画面の操作（`operate`）は書かない。変わらない業務は `apps/web/step` の値を使う。置き換え先・旧システムのテーブルは値を import して指す。旧システムの画面の手順は、画面の操作を並べるだけ |
| `legacy-table` | 旧システムのテーブルは列の名前と意味を書く。列の移す先（`テーブル.列`）は、新しいテーブル（マイグレーション）にあるものにする |
| `estimate`・`estimate-item` | 見積は `defineEstimate('YYYY-MM-DD', { title, items })` で、変数の名前は `estimate` と日付。項目は名前と金額（数のリテラル）で、対象は import した値 |
| `effort` | 工数は `defineEffort([{ target, audit, manual }])` で、対象は import した値、人日は 0 以上の数のリテラル。1つの対象に1つ |
| `skill` | Skill は `.claude/skills/minutes`（文字起こしから議事録を作る）の1つだけで、先頭に `name: minutes` と `description` を書く。ほかの Skill・AI に向けた指示のファイル（`CLAUDE.md`・`AGENTS.md`・`.cursorrules` など）・置き場所（`.claude/commands`・`.agents` など）は置かない |

ほかに、型（未着手のシナリオに値を渡さない、拡張のキー、画面にない文言のキー）と lint（単語帳・動詞で始まる関数名）でも止まる。

## 7. 受託開発の要件定義

受託開発で、要件定義を先方との会話で進めるための書き方である（役割・議事録・現行の業務フロー・見積）。GitHub でコードを書くのは開発チームだけで、先方はブラウザ（8章）で業務フローと議事録を読む。

### 7.1 役割

```ts
// apps/web/role/role.ts
export const projectManager = defineRole('projectManager', { side: 'vendor' })   // PM
export const engineer = defineRole('engineer', { side: 'vendor' })
export const accountant = defineRole('accountant', { side: 'business' })         // 経理担当
export const approver = defineRole('approver', { side: 'business' })
export const customer = defineRole('customer', { side: 'external' })
```

- 人の名前は書かない。業務フローの担当・議事録の出席者・課題の担当は、すべて役割で指す。
- 役割は `apps/web/role/role.ts` に `defineRole(名前, { side })` で書く。名前は変数と同じ・単語帳の名詞にする。
- 立場（`side`）は3つにする。`vendor` は開発チーム（PM・エンジニア）、`business` は業務部門（先方の経理担当・営業担当・承認者）、`external` は業務の相手（顧客。業務フローには出るが、打合せには出ない）。
- 業務フローの担当・シナリオの主アクターは、役割の値を import して渡す。文字で書くと型のエラーになる。

### 7.2 議事録

```ts
// apps/web/meeting/meeting20261017.ts
export const meeting20261017 = defineMeeting('2026-10-17', {
  title: '第2回（入金の業務）',
  attendees: [projectManager, engineer, accountant, approver],
  agenda: [paymentManagement, overpaymentRefund, transferFeeDeduction, registerPayment],
  decisions: [
    decide(overpaymentRefund, '請求先から返金の依頼があれば返金し、なければ次の請求で差し引く', {
      question: meeting20261003.questions.overpaymentHandling,   // 前の回の課題を、この決定で解決する
    }),
    decide([extensionOf(registerPayment, 'unidentifiedPayer'), PaymentListPage], '振込人を特定できない入金は仮受にし、入金の一覧で顧客を特定する'),
    decide([paymentManagement, decidePaymentCustomer], '顧客を選んで記録した振込依頼人名は覚え、次から自動で顧客を特定する'),
  ],
  questions: {
    refundCreation: raise(createRefund, '返金を登録する画面で、振込先の口座まで入れるか、返金した日と金額だけにするか', {
      assignee: accountant,
      deadline: '2026-10-31',
    }),
  },
})
```

- 議事録は1回の打合せを1ファイルにし、`apps/web/meeting/meeting<日付>.ts` に `defineMeeting('YYYY-MM-DD', { … })` で書く。変数の名前は `meeting` と日付（`meeting20261017`）にする。
- 打合せで話したことは、**決めたこと（`decide`）か課題（`raise`）のどちらか**にする。経緯や雑談は書かない。
- 決めたこと・課題・議題は、話している場所を import した値で指す。いくつもあれば配列で並べる。

| 場所 | 書き方 | 使うとき |
| --- | --- | --- |
| 業務フロー | `monthlyInvoice` | 業務の流れ・抜けている業務の話（最初の打合せはほとんどこれ） |
| シナリオ | `createRefund` | 1人の画面の操作の話 |
| 拡張 | `extensionOf(registerPayment, 'mistakenPayment')` | うまくいかない場合の扱いの話。拡張の名前はシナリオの `extensions` のキー（型で検査する） |
| 画面・処理・規則などの関数 | `PaymentListPage`・`closeInvoice`・`decidePaymentCustomer` | 決まったことが、画面の部品・処理（usecase）・規則（domain）に表れているとき。関数なら何でも指せる |

- 課題は `questions` に、名前（単語帳の言葉）をキーにして書く。解決する役割（`assignee`）と期限（`deadline`、打合せの日以後）を必ず決める。
- 課題を解決したら、後の打合せの議事録で `decide(場所, 決めたこと, { question: 前の議事録.questions.課題の名前 })` と書く。課題が解決したかどうかは書かない。その課題を指す決定があれば「解決済み」、なく期限を過ぎていれば「期日超過」、どちらでもなければ「未解決」と、ブラウザが求める。
- 業務フロー・シナリオ・拡張・関数の名前を変えたり消したりすると、それを指す議事録が型のエラーになる。決めたことも課題も、宙に浮かない。
- 一度書いた議事録も、誤りがあれば直してよい。

### 7.3 要件定義の進め方 — このサイクルで会話すればよい

システムを作るための会話は、次のサイクルを回せばよい。

1. **開発チームがヒアリングをし、提案する。** ブラウザのレーン図を先方と一緒に見ながら、抜けている業務はないか・順序は合っているかを話す。最初は業務フローの粒度で話し、決まってきたらシナリオ・拡張・画面の粒度へ下りる。
2. **先方が返事をする。** 同意でも不同意でも、返事はそのまま議事録の決めたことか課題になる。先方の承認を別に記録する仕組みは持たない。
3. **文字起こしや手元のメモを AI に渡し、議事録の TypeScript を作ってもらい、PR にする。** AI は Skill `minutes` の手順で書き、話で変わった業務フロー・シナリオ・画面も同じ PR で直す（7.4）。
4. **開発チームと先方でレビューし、問題なければマージする。** 先方はブラウザで議事録と業務フローを読む。先にマージして、あとで見直して直してもよい。

紐づけは、議事録 → 課題・決めたこと → 業務フロー・シナリオ・画面・処理、と型で持つ。課題は話した場所（業務フロー・シナリオ・拡張・処理）のページとキャンバスに「未解決の課題」として出る。**未解決の課題がなくなれば、要件定義で決めることは残っていない。** 人は、課題を解決するための会話をすればよい。

### 7.4 AI に議事録を作ってもらうとき — 唯一の Skill

文字起こしから議事録を作る手順は、Skill `minutes`（`.claude/skills/minutes/SKILL.md`）に書いた。文字起こし・手元のメモを渡して「議事録にして」と頼むと、AI は話したことを決めたことと課題に分け、`apps/web/meeting` の TypeScript にし、話で変わった業務フロー・シナリオも直して、`pnpm check` を通してから PR にする。

**AI に向けた指示は、この Skill の1つだけにする。** ほかの書き方の決まりは、型・lint・`pnpm check`（CI と同じ）が止める。AI は止まったところを直せばよいので、決まりを AI 向けの文書に書き写さない。ほかの Skill や、AI に向けた指示のファイル（`CLAUDE.md`・`AGENTS.md` など）を置くと、規則 `skill`（6章）で止まる。

### 7.5 現行の業務フロー（AsIs）

ヒアリングでは、いまの業務（AsIs）も聞く。現行の業務フローも型で書き、新しい業務フロー（ToBe）と比べられるようにする。現行の業務は実装しないので、画面の操作の手順・処理・ケースは書かない。

```ts
// apps/web/legacy/invoice/legacyMonthlyInvoice.ts
export const legacyMonthlyInvoice = defineLegacyFlow('legacyMonthlyInvoice', {
  replacement: monthlyInvoice,                                            // 置き換え先の新しい業務フロー
  steps: [
    deliverProduct,                                                       // 変わらない業務は、apps/web/step の同じ値
    operateLegacy(accountant, 'enterSales', { tables: [legacySales], replacement: createSales }),
    elapse('closingDate'),                                                // 現行の業務フローには日付を書かない
    operateLegacy(accountant, 'printInvoice', { tables: [legacySales, legacyInvoice], replacement: [closeInvoice, issueInvoice] }),
    outside(accountant, 'copyInvoice'),                                   // 置き換え先がなければ廃止
    outside(accountant, 'mailInvoice', { replacement: sendInvoice }),     // 変わる業務は、置き換え先を書く
    payInvoice,
    operateLegacy(accountant, 'enterPayment', { tables: [legacyPayment], replacement: registerPayment }),
  ],
})
```

- 現行の業務フローは `apps/web/legacy/<領域>/` に、`defineLegacyFlow` で書く。名前は `legacy` で始める（`legacyMonthlyInvoice` →「現行の月次の請求」）。
- `replacement` に、置き換え先の新しい業務フローを値で書く（いくつでもよい）。書かなければ、その業務はなくなる。
- 段は次の5種類にする。

| 段 | 書き方 |
| --- | --- |
| 変わらない業務・イベント | `apps/web/step` の値（新しい業務フローと同じ値） |
| 変わる業務・イベント | `outside(担当, 名前, { replacement })`・`occur(担当, 名前, { replacement })` |
| 旧システムの操作 | `operateLegacy(担当, 名前, { tables, replacement, operate, confirm })` |
| 時の経過 | `elapse(名詞)`（日付は書かない） |
| 子フロー | `nest(現行の業務フロー)` |

- 置き換え先（`replacement`）は、新しい業務フローのシナリオ・`apps/web/step` の値・業務フローを値で指す。いくつでもよい。新しい業務フローやシナリオの名前を変えたり消したりすると、型のエラーになる。
- 旧システムの操作には、残したければ画面の手順（`operate`）と、そのあと確かめること（`confirm`）を書ける。実装はないので動かさず、スタブの E2E のように手順の形で残す。画面・項目・ボタンの名前は、旧システムの画面の文言をそのまま書く。画面の操作（`await screen.…`）を並べるだけにする。

```ts
operateLegacy(accountant, 'enterSales', {
  tables: [legacySales],
  replacement: createSales,
  operate: async (screen) => {
    await screen.go('売上伝票入力')              // 旧システムのメニューの名前
    await screen.fill('得意先コード', '000123')
    await screen.press('登録(F12)')
  },
  confirm: async (screen) => {
    await screen.expectText('登録しました')
  },
})
```

- 旧システムのテーブルは `defineLegacyTable(物理名, { title, note, columns })` で書く。列には物理名・意味・型・備考と、移す先の新しいテーブルの列（`replacement: 'sales.sales_date'`）を書く。移す先は検査でマイグレーションと照らし合わせる。

静的解析は、現行の業務フローの段を、置き換え先の新しい業務フロー（子フローの中まで）と比べる。

- **同じ**: 新しい業務フローにも同じ値の段がある（時の経過は名詞が同じ）。
- **置き換え**: 置き換え先を書いた段。
- **廃止**: どちらでもない段。
- **新しい段**: 新しい業務フローにあって、現行のどの段からも指されていない段。

議事録の決めたこと・課題からも、現行の業務フローと旧システムのテーブルを指せる。

### 7.6 見積

見積も型で取り込み、現行の業務フロー・新しい業務フロー・機能まで追えるようにする。見積は任意で、書かなくても検査は止まらない。

```ts
// apps/web/estimate/estimate20261031.ts
export const estimate20261031 = defineEstimate('2026-10-31', {
  title: '見積（第3回の打合せのあと）',
  items: [
    { title: '要件定義（打合せ・議事録）', amount: 1_000_000 },
    { title: '売上の登録', amount: 400_000, targets: [createSales, SalesCreatePage] },
    { title: '旧システムのデータの移行', amount: 900_000, targets: [legacySales, legacyInvoice, legacyPayment] },
    { title: '出精値引', amount: -300_000 },
  ],
})
```

- 見積は版ごとに1ファイルにし、`apps/web/estimate/estimate<日付>.ts` に `defineEstimate('YYYY-MM-DD', { title, items })` で書く。変数の名前は `estimate` と日付にする。
- 項目の最小の単位は、項目の名前（`title`）と金額（`amount`、円の数）。値引は負の金額で書く。
- 項目の対象（`targets`）は書かなくてもよい。書くときは、議事録と同じく、新しい業務フロー・シナリオ・拡張・画面の部品・処理・規則・現行の業務フロー・旧システムのテーブルを import した値で指す。名前を変えたり消したりすると、型のエラーになる。
- いちばん新しい版で、どの項目からも指されていないシナリオを「未見積のシナリオ」として数える（止めない）。業務フローを指した項目は、その業務フロー（子フロー・拡張の段を含む）のシナリオを見積もったことにする。画面・処理を指した項目は、その画面を開く・その処理を通るシナリオを見積もったことにする。
- 見積の書類（表計算など）から取り込むときは、AI に頼んでよい。決まりは検査が教える。

**機能ごとの工数。** 要件が固まったあとの新しいシステムがいくらかを出すため、機能ごとの工数（人日）も型で持てる（任意）。工数は2つ持つ。

- `audit`（監査の工数）: AI が作った機能を、人がそれでよいと監査する工数。AI 開発の時代の実際の工数。
- `manual`（人手の工数）: もし人がコーディングとテストをしたら、という工数。ウォーターフォールの見積の考え方で、バッファを含む値段をつける営業の再見積に使う。

```ts
// apps/web/effort/effort.ts
export const effort = defineEffort([
  { target: createSales, audit: 0.5, manual: 5 },
  { target: monthlyInvoice, audit: 1, manual: 5 },        // 業務フローの E2E
  { target: legacySales, audit: 0.5, manual: 4 },         // 旧システムのデータの移行
])
```

- 工数は `apps/web/effort` に `defineEffort([{ target, audit, manual }])` で書く。対象は見積と同じ場所を値で指す。1つの対象に1つにする。
- 見積に人日単価（`rate`、円）を書くと、工数を金額にする。
- いちばん新しい見積の各項目に、その項目が対象をいちばん直接に指している工数を割り当てる（同じ対象 > 業務フローの中のシナリオ > シナリオが開く画面・通る処理）。どの項目にも当たらない工数は「未見積の工数」として残す。
- 工数を書いたシナリオがあるときは、工数のないシナリオも数える（止めない）。
- 人手の工数は先方に見せないほうがよい情報だが、いまはブラウザに出る。先方向けの表示から外す仕組みは TODO（[要求と方針](requirements.md) の 8.1 の 11）。

## 8. コードのブラウザ

`pnpm dev:browser` で開く。静的解析で作ったモデル（`apps/browser/generated/model.ja.json`・`model.en.json`。リポジトリには入れない）を読む。画面の上の「English／日本語」で言語を切り替える（ブラウザに覚える）。画面の文言・業務フローとシナリオの見出しと手順・処理の手順・テーブルの列は、同じ単語帳から両方の言語で作る。人が日本語で書いたもの（事前条件・拡張の条件・ケースの見出し・入力の値）は、書いたまま出す。

### 8.1 キャンバス（最初の画面）

画面の外まで広がる領域（キャンバス）に、業務フローをフレームとして並べる。業務の領域（請求・入金・売上・顧客。`apps/web/flow/<領域>/` のフォルダ）ごとに列にし、列の中に業務フローを縦に積む。子フローを持つ業務フローのある領域を先にし、領域の中は段の多い業務フローから並べる。

- **動かす:** 背景をドラッグ（スペースを押しながら、または中ボタンなら、カードの上でも動かせる）。ホイールで上下左右に動く。矢印キーでも動く。右下のミニマップを押す・ドラッグすると、そこへ動く。
- **拡大・縮小:** Ctrl（⌘）＋ホイール（ポインタの位置を中心に）、右上のボタン、`+`・`-` キー。倍率を押すと 100%、「全体表示」（Shift＋1）で全体が収まる。
- **開く:** 最上位の業務フローは開いて置き、子フローは閉じて置く（フレームの名前を押すと開閉する）。
  - レーン図の子フローの段を押すと、その場で中の段を並べる（上の帯を押すと閉じる）。
  - 段を押すと、その下にカードが開く（画面の操作ならシナリオ、ほかは段の説明）。右の段のカードほど上に並べ、段からカードへの線が重ならないようにしている。
  - シナリオのカードの中で、入力・主な成功シナリオ・成功の保証・拡張・ケースを折りたたみで開く。処理を押すと右に処理のカード、処理のカードで SQL を押すと SQL のカード、SQL のカードでテーブルを押すとテーブルのカードが開く。
  - 業務フローの拡張（5a など）がある段では、シナリオのカードに拡張の流れが出る。その中の段を押すと、右にその段のカードが開く。
- **フレームを動かす:** フレームの名前をドラッグすると、好きな位置に動かせる（押しただけなら開閉）。名前の横の印で、そのフレームを画面に収める。
- **探す:** 上の検索（Ctrl（⌘）＋K）で、業務フロー・シナリオ・処理を名前で探す。選ぶと、その段（拡張の中の段も）のカードを開いて、そこへ寄せる。処理を選ぶと、それを通る最初のシナリオのカードと、処理のカードを開く。
- **保存:** 視点・フレームの位置と開閉・開いたカード・折りたたみは、ブラウザに保存する。次に開いたときも、同じところから続けられる。「初期化」で、開いたカードとフレームの位置を最初に戻す。
- **左のパネル:** 業務フローを領域ごとに並べ、未着手のシナリオの段がある業務フローには「未着手」と数を付ける。名前を押すと、そのフレームを開いて画面に収める。進み具合（未着手の数）と規則の問題の数も出す。
- **課題:** 未解決の課題がある業務フローは、フレームの名前の横に「未解決の課題」と数を出す。シナリオのカードには「課題」の折りたたみが付き、未解決の課題があれば開いて置く。

### 8.2 一覧と詳細のページ

- 一覧: 進み具合（議事録の数、課題と未解決の数、現行の業務フロー、見積の合計と未見積のシナリオの数、工数の合計と工数のないシナリオの数を含む）・規則の問題・業務フロー（領域ごと。未着手の数付き）・シナリオ・処理・テーブルの一覧と、名前の検索。
- 現行（上のナビゲーションの「現行」）: 現行の業務フロー（領域ごと。置き換え先と、同じ・置き換え・廃止・新しい段の数）と、旧システムのテーブルの一覧。
- 現行の業務フロー: レーン図（旧システムの操作と、段ごとの変わり方）、新しい業務フローとの比べ（段・変わり方・置き換え先・旧システムのテーブル）、画面の比較（旧システムの画面の手順と、置き換え先のシナリオの手順を並べる）、新しい段、指している課題と決めたこと。
- 旧システムのテーブル: 列（意味・物理名・型・備考・移す先の新しいテーブルの列）と、使っている現行の業務フローの段。
- 見積（上のナビゲーションの「見積」）: 版ごとの日付・項目の数・合計と、いちばん新しい版の未見積のシナリオ。版のページには、項目の名前・対象・金額と合計、前の版との差。いちばん新しい版には、項目に割り当てた人手の工数・監査の工数と、人日単価をかけた金額、工数の合計からの金額（見積との差）、未見積の工数も出す。業務フロー・シナリオ・処理・現行の業務フロー・旧システムのテーブルのページにも、そこを指す、いちばん新しい版の項目と金額、機能ごとの工数を出す。
- 議事録（上のナビゲーションの「議事録」）: 未解決の課題（期限の順。担当の役割・期限・期日超過）、議事録の一覧（日付・決めたこと・課題・解決した課題の数）、役割の一覧（立場ごと）。
- 1回の議事録: 出席者（立場ごと）、議題、決めたこと（指している場所と、解決した課題）、課題（場所・担当・期限・状態）。場所を押すと、その業務フロー・シナリオ・処理のページへ移る。
- 業務フロー: 担当ごとのレーン図（子フローは中を開く）、段の表、拡張、テストの経路、置き換わる現行の業務フロー、その業務フローの課題と決めたこと（議事録へのリンク付き）。
- シナリオ: 主アクター・使う業務フロー・主な成功シナリオ・成功の保証・拡張の表・ケース（行の表と、中身の日本語の手順）・開く画面・通る処理（押すボタンから呼ぶものと、画面を開いて読むもの）、そのシナリオ・拡張・開く画面・通る処理を指す課題と決めたこと。
- 処理: usecase の手順、通る規則（domain の関数の訳）、リポジトリの呼び出しと SQL、API の入口、使うシナリオ、その処理・規則を指す課題と決めたこと。
- SQL・テーブル: SQL の全文と、使うテーブル・処理。テーブルの列の日本語。
- 用語集: 単語帳の業務の言葉（日本語・英語・名前・説明）。

キャンバスのカードの「詳細ページ」から、それぞれのページへ移れる。

開いている間は、業務フロー・シナリオ・段の値・役割・議事録・現行の業務フロー・見積・工数・画面・バックエンド・単語帳のソースを保存するたびに、後ろでモデルを作り直す（全体の解析は約 0.2 秒）。作り直すと、開いている画面が新しいモデルを表示する。`pnpm --filter @app/browser build` で静的なファイルにでき、S3 などに置ける。
