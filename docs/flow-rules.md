# 業務フローの書き方の規則

業務フロー・シナリオ・ケース・役割・議事録の書き方と、その検査の規則をまとめる。なぜこの形にしたかは [このリポジトリの考え方](concept.md) の6章にある。

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
    outside(salesperson, 'deliverProduct'),
    operate(createSales, { customer: '株式会社子', salesDate: '2026-10-15', salesKind: '通常', itemName: '運賃', salesAmount: '100000', taxRate: '10%' }),
    elapse('closingDate', '2026-10-31'),
    operate(closeInvoice, { ...october, breakdown: { currentSalesAmount: 100_000, taxAmount: 10_000, currentInvoiceAmount: 110_000 } }),
    operate(browseInvoice, october, {
      mistakenInvoice: { input: october, then: [operate(cancelClosing, october), …], resume: false },
    }),
    operate(issueInvoice, { ...october, issueDate: '2026-11-02' }),
    outside(accountant, 'sendInvoice'),
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
| システムの外の業務 | `outside(担当, 動詞で始まる名前)` | 商品を納品する・請求書を送るなど | 何もしない（流れ図に出す） |
| 外のイベント | `occur(担当, 動詞で始まる名前)` | 顧客が請求を支払うなど | 何もしない（必要ならデータを作る段にする） |
| 時の経過 | `elapse(名詞, 'YYYY-MM-DD')` | 締め日になるなど | テストの今日の日付をその日にする |
| 子フロー | `nest(業務フロー)` | 別の業務フローをひとまとまりで入れる | 子フローの段を、その場で流す |

- 担当は、`apps/web/role` に書いた役割の値で渡す（`salesperson` 営業担当・`accountant` 経理担当・`customer` 顧客。[7章](#7-役割と議事録)）。シナリオの担当はシナリオの側に書く。
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
| `step-name` | システムの外の業務・外のイベントの名前は動詞で始め、担当は役割の値 |
| `elapse` | 時の経過は単語帳の名詞と、YYYY-MM-DD の日付 |
| `scenario-form`・`scenario-name`・`actor` | シナリオは `defineScenario(名前, { actor, … })`。名前は変数と同じ・単語帳の言葉・動詞で始める。担当は役割の値 |
| `scenario-start` | 手順は画面を開く（`screen.go`）ところから始める |
| `scenario-flat` | 手順と成功の保証は、画面の操作を並べるだけ |
| `scenario-orphan` | シナリオは、どれかの業務フローの段（拡張の段を含む）になっている |
| `extension-name` | 拡張のキーは単語帳の言葉 |
| `case-place` | ケースはシナリオの隣の `.test.tsx` に、`describeScenario` だけで書く |
| `case-main` | 主成功シナリオのケースは1つ |
| `case-extension` | 拡張のケースは、シナリオにある拡張を指す |
| `test-place` | `apps/web` の画面のテストは、`scenario` と `flow` にだけ置く（`e2e` は、同じ業務フローを実ブラウザで流すだけ） |
| `role` | 役割は `apps/web/role` に `defineRole(名前, { side })` で書く。名前は変数と同じ・単語帳の名詞、立場は `vendor`・`business`・`external` |
| `meeting` | 議事録は `defineMeeting('YYYY-MM-DD', { … })` で、変数の名前は `meeting` と日付 |
| `meeting-place` | 議題・決めたこと・課題は、業務フロー・シナリオ・`extensionOf(シナリオ, 拡張)` を import して指す |
| `meeting-role` | 出席者・課題の担当・承認した役割は、役割の値を import して渡す |
| `question-name`・`question-deadline` | 課題の名前は単語帳の言葉。期限は YYYY-MM-DD で、打合せの日以後 |
| `answer` | 回答は `answer(議事録.questions.課題の名前, 回答)` の形で、課題を挙げた打合せより後の打合せで1回だけ |
| `approval` | 承認の日は打合せの日以後で、承認するのは業務部門の役割 |

ほかに、型（未着手のシナリオに値を渡さない、拡張のキー、画面にない文言のキー）と lint（単語帳・動詞で始まる関数名）でも止まる。

## 7. 役割と議事録

受託開発で、要件定義を先方と打合せながら進めるための書き方である。GitHub でコードを書くのは開発チームだけで、先方はブラウザ（8章）で業務フローと議事録を読む。

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
  answers: [
    answer(meeting20261003.questions.overpaymentHandling, '請求先から返金の依頼があれば返金し、なければ次の請求で差し引く'),
  ],
  decisions: [
    decide(extensionOf(registerPayment, 'unidentifiedPayer'), '振込人を特定できない入金は仮受にし、入金の一覧で顧客を特定する'),
  ],
  questions: {
    mistakenRefund: raise(extensionOf(registerPayment, 'mistakenPayment'), '他社宛の誤入金を返金するとき、誰の承認が要るか', {
      assignee: approver,
      deadline: '2026-10-31',
    }),
  },
  approval: { on: '2026-10-20', by: approver },
})
```

- 議事録は1回の打合せを1ファイルにし、`apps/web/meeting/meeting<日付>.ts` に `defineMeeting('YYYY-MM-DD', { … })` で書く。変数の名前は `meeting` と日付（`meeting20261017`）にする。
- 議題（`agenda`）・決めたこと（`decide`）・課題（`raise`）は、話している場所を値で指す。場所は粒度に合わせて選ぶ。

| 場所 | 書き方 | 使うとき |
| --- | --- | --- |
| 業務フロー | `monthlyInvoice` | 業務の流れ・抜けている業務の話（最初の打合せはほとんどこれ） |
| シナリオ | `createRefund` | 1人の画面の操作の話 |
| 拡張 | `extensionOf(registerPayment, 'mistakenPayment')` | うまくいかない場合の扱いの話。拡張の名前はシナリオの `extensions` のキー（型で検査する） |

- 課題は `questions` に、名前（単語帳の言葉）をキーにして書く。答える役割（`assignee`）と期限（`deadline`、打合せの日以後）を必ず決める。
- 課題に答えたら、後の打合せの議事録の `answers` に `answer(前の議事録.questions.課題の名前, 回答)` と書く。課題が解決したかどうかは書かない。回答があれば「回答済み」、なく期限を過ぎていれば「期日超過」、どちらでもなければ「未回答」と、ブラウザが求める。
- 先方が議事録を確かめたら、開発チームが `approval: { on: 確かめた日, by: 役割 }` を書く。確かめるのは業務部門の役割にする。書くまでは「未承認」と出る。
- 業務フロー・シナリオ・拡張の名前を変えたり消したりすると、それを指す議事録が型のエラーになる。課題が、どの業務の話だったか分からなくなることはない。

### 7.3 打合せの進め方

1. **打合せの前に**、開発チームが、議題の業務フローを書いて（中身が空のシナリオでよい）ブラウザを用意する。前の回の課題で、期限が来るものを「議事録」の画面の未回答の一覧で確かめる。
2. **打合せの中で**、ブラウザのレーン図を先方と一緒に見ながら、抜けている業務はないか・順序は合っているかを話す。最初は業務フローの粒度で話し、決まってきたらシナリオ・拡張の粒度へ下りる。
3. **打合せの後に**、開発チームが議事録を書き、話で変わった業務フロー・シナリオも同じ変更で直す。先方には、ブラウザの議事録のページを見せて確かめてもらい、確かめた日を `approval` に書く。
4. 課題は、話した場所（業務フロー・シナリオ・拡張）のページとキャンバスのカードに「未回答の課題」として出る。シナリオの中身が細かくなっても、課題はその場所に残る。

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
- **課題:** 未回答の課題がある業務フローは、フレームの名前の横に「未回答の課題」と数を出す。シナリオのカードには「課題」の折りたたみが付き、未回答の課題があれば開いて置く。

### 8.2 一覧と詳細のページ

- 一覧: 進み具合（議事録と未承認の数、課題と未回答の数を含む）・規則の問題・業務フロー（領域ごと。未着手の数付き）・シナリオ・処理・テーブルの一覧と、名前の検索。
- 議事録（上のナビゲーションの「議事録」）: 未回答の課題（期限の順。担当の役割・期限・期日超過）、議事録の一覧（日付・承認・決めたこと・課題・回答の数）、役割の一覧（立場ごと）。
- 1回の議事録: 承認（承認済み・確かめた日・役割、または未承認）、出席者（立場ごと）、議題、前の回の課題への回答、決めたこと、課題（場所・担当・期限・状態）。場所を押すと、その業務フロー・シナリオのページへ移る。
- 業務フロー: 担当ごとのレーン図（子フローは中を開く）、段の表、拡張、テストの経路、その業務フローの課題と決めたこと（議事録へのリンク付き）。
- シナリオ: 主アクター・使う業務フロー・主な成功シナリオ・成功の保証・拡張の表・ケース（行の表と、中身の日本語の手順）・開く画面・通る処理（押すボタンから呼ぶものと、画面を開いて読むもの）、そのシナリオと拡張の課題と決めたこと。
- 処理: usecase の手順、通る規則（domain の関数の訳）、リポジトリの呼び出しと SQL、API の入口、使うシナリオ。
- SQL・テーブル: SQL の全文と、使うテーブル・処理。テーブルの列の日本語。
- 用語集: 単語帳の業務の言葉（日本語・英語・名前・説明）。

キャンバスのカードの「詳細ページ」から、それぞれのページへ移れる。

開いている間は、業務フロー・シナリオ・役割・議事録・画面・バックエンド・単語帳のソースを保存するたびに、後ろでモデルを作り直す（全体の解析は約 0.2 秒）。作り直すと、開いている画面が新しいモデルを表示する。`pnpm --filter @app/browser build` で静的なファイルにでき、S3 などに置ける。
