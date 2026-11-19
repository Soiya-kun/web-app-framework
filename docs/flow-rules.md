# 業務フローの書き方の規則

業務フロー・シナリオ・ケースの書き方と、その検査の規則をまとめる。なぜこの形にしたかは [このリポジトリの考え方](concept.md) の6章にある。

書いた時点: 2026-11-19。規則は `pnpm flow:check`（`pnpm check` に含まれる）が検査する。

## 1. 全体の形

業務フローは、コーバーン『ユースケース実践ガイド』の目的のレベルに合わせて、4つの階層で書く。

| 階層 | コーバーンのレベル | 書く場所 | 書くもの | テストとしての動き |
| --- | --- | --- | --- | --- |
| 業務フロー | 要約 | `apps/web/flow/*.ts` | `defineFlow`: 段の並び | 本線と拡張ごとの経路を E2E として流す（`apps/web/flow/flow.test.tsx`） |
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
    outside('salesperson', 'deliverItem'),
    operate(createSales, { customer: '株式会社子', salesDate: '2026-10-15', salesKind: '通常', itemName: '運賃', salesAmount: '100000', taxRate: '10%' }),
    elapse('closingDate', '2026-10-31'),
    operate(closeInvoice, { ...october, breakdown: { currentSalesAmount: 100_000, taxAmount: 10_000, currentInvoiceAmount: 110_000 } }),
    operate(browseInvoice, october, {
      mistakenInvoice: { input: october, then: [operate(cancelClosing, october), …], resume: false },
    }),
    operate(issueInvoice, { ...october, issueDate: '2026-11-02' }),
    outside('accountant', 'sendInvoice'),
    nest(paymentManagement),
    elapse('closingDate', '2026-11-30'),
    operate(closeInvoice, { … }),
  ],
})
```

### 2.1 規則

- 名前は**名詞句**で、単語帳の言葉だけで書く（`monthlyInvoice` →「月次の請求」）。変数の名前と同じにする。
- 1行目の TSDoc に、業務フローの目的を書く。
- `precondition` に、事前条件を日本語（`summary`）と、テストで最初に入れておく行（`seed`）で書く。子フローとして使うときは、親の事前条件だけを使う。
- 段は次の5種類だけにする。

| 段 | 書き方 | 意味 | テストで流すとき |
| --- | --- | --- | --- |
| 画面の操作 | `operate(シナリオ, 値, 拡張)` | 1人が画面で目的を果たす | シナリオの手順と成功の保証を流す |
| システムの外の業務 | `outside(担当, 動詞で始まる名前)` | 品目を納める・請求書を送るなど | 何もしない（流れ図に出す） |
| 外のイベント | `occur(担当, 動詞で始まる名前)` | 顧客が請求を支払うなど | 何もしない（必要ならデータを作る段にする） |
| 時の経過 | `elapse(名詞, 'YYYY-MM-DD')` | 締め日になるなど | テストの今日の日付をその日にする |
| 子フロー | `nest(業務フロー)` | 別の業務フローをひとまとまりで入れる | 子フローの段を、その場で流す |

- 担当（`actor`）は単語帳の名詞にする（`salesperson` 営業担当・`accountant` 経理担当・`customer` 顧客）。シナリオの担当はシナリオの側に書く。
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
/** 振り込まれた代金を記録し、次の締めで請求先の残高を減らすため。 */
export const registerPayment = defineScenario('registerPayment', {
  actor: 'accountant',
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
- 1行目の TSDoc に、目的（なぜこの操作をするか）を書く。
- `actor` に主アクターを書く（単語帳の名詞）。
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
| `expectMessage(文, 値)` | 知らせの文が出ている | 「…」と出ることを確かめる |
| `expectAlert(文, 値)` | 警告の文が出ている | 警告「…」が出ることを確かめる |
| `expectProblem(項目, 文, 値)` | 項目の下に問題の文が出ている | 入金額に「…」と出ることを確かめる |
| `expectHeading(見出し)` | その画面に移った | 「請求詳細」の画面になったことを確かめる |
| `expectCells(表, { 列: 値 })` | 表の1行目の値（数は金額として円の表示と比べる） | 「請求の内訳」の1行目が、…であることを確かめる |
| `expectRows(表, 行)` | 表の全ての行 | 「請求の内訳」の行を確かめる |
| `expectText(文字)` / `expectNoButton(ボタン)` / `expectOptions(項目, 選択肢)` | 文字が出ている／ボタンが出ていない／選択肢の並び | — |

インプロセスのテストでは Testing Library で動かす（`@app/flow/testing`）。同じシナリオを、実ブラウザ（Playwright）で動かす部品に差し替えられる形にしてある（まだ作っていない）。

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
| 1 | 主アクターと目的 | 業務フローの段と、名前と担当だけのシナリオ（`defineScenario('createSales', { actor: 'salesperson' })`） | 担当ごとのレーン図。シナリオはすべて未着手 |
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
| `step-name` | システムの外の業務・外のイベントの名前は動詞で始め、担当は単語帳の名詞 |
| `elapse` | 時の経過は単語帳の名詞と、YYYY-MM-DD の日付 |
| `scenario-form`・`scenario-name`・`actor` | シナリオは `defineScenario(名前, { actor, … })`。名前は変数と同じ・単語帳の言葉・動詞で始める。担当は単語帳の名詞 |
| `scenario-start` | 手順は画面を開く（`screen.go`）ところから始める |
| `scenario-flat` | 手順と成功の保証は、画面の操作を並べるだけ |
| `scenario-orphan` | シナリオは、どれかの業務フローの段（拡張の段を含む）になっている |
| `extension-name` | 拡張のキーは単語帳の言葉 |
| `case-place` | ケースはシナリオの隣の `.test.tsx` に、`describeScenario` だけで書く |
| `case-main` | 主成功シナリオのケースは1つ |
| `case-extension` | 拡張のケースは、シナリオにある拡張を指す |
| `test-place` | `apps/web` の画面のテストは、`scenario` と `flow` にだけ置く |

ほかに、型（未着手のシナリオに値を渡さない、拡張のキー、画面にない文言のキー）と lint（単語帳・動詞で始まる関数名）でも止まる。

## 7. コードのブラウザ

`pnpm dev:browser` で開く。静的解析で作ったモデル（`apps/browser/generated/model.json`。リポジトリには入れない）を読む。

### 7.1 キャンバス（最初の画面）

画面の外まで広がる領域（キャンバス）に、業務フローをフレームとして並べる。

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
- **左のパネル:** 業務フローの名前を押すと、そのフレームを開いて画面に収める。進み具合（未着手の数）と規則の問題の数も出す。

### 7.2 一覧と詳細のページ

- 一覧: 進み具合・規則の問題・業務フロー・シナリオ・処理・テーブルの一覧と、名前の検索。
- 業務フロー: 担当ごとのレーン図（子フローは中を開く）、段の表、拡張、テストの経路。
- シナリオ: 主アクター・目的・使う業務フロー・主な成功シナリオ・成功の保証・拡張の表・ケース（行の表と、中身の日本語の手順）・開く画面・通る処理（押すボタンから呼ぶものと、画面を開いて読むもの）。
- 処理: usecase の手順、通る規則（domain の関数の訳）、リポジトリの呼び出しと SQL、API の入口、使うシナリオ。
- SQL・テーブル: SQL の全文と、使うテーブル・処理。テーブルの列の日本語。
- 用語集: 単語帳の業務の言葉（日本語・英語・名前・説明）。

キャンバスのカードの「詳細ページ」から、それぞれのページへ移れる。

開いている間は、業務フロー・シナリオ・画面・バックエンド・単語帳のソースを保存するたびに、後ろでモデルを作り直す（全体の解析は約 0.2 秒）。作り直すと、開いている画面が新しいモデルを表示する。`pnpm --filter @app/browser build` で静的なファイルにでき、S3 などに置ける。

## 8. まだしていないこと

- 実ブラウザ（Playwright）と実 DB で、最上位の業務フローを流す部品。
- ブラウザの英語の表示（モデルの日本語の訳は単語帳から作っているので、英語の訳を足せば出せる）。
