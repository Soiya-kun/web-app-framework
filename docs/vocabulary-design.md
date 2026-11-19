# 単語帳の設計（英語と日本語を構造で統一する）

状態: 実装済み（2026-11-19）。1章が目指したことと結果、2章以降が仕組み。

## 1. 目指したことと結果

| 目指したこと | 仕組み | 結果 |
| --- | --- | --- |
| コードは英語で書く | 名前は lint で単語帳の英単語と、決まった並び（動詞で始める関数名など）に限る | `apps/**`・`packages/backend/**` と DB の名前で、単語帳にない単語は CI で止まる |
| コードを日本語で読める | 同じ単語帳と日本語の文法から、関数の題（体言止め）と手順（〜する）を作る | [処理の日本語訳](generated/backend-process.md)（関数 74） |
| 画面でも同じ専門用語を使う | 画面の文言は、単語帳から生成した文言ファイルだけから引く | 画面のコードに日本語・英語の文言を直接書かない（キーは型で検査） |
| 多言語も同じマスタから出す | 単語帳（言語に依らない概念）＋言語ごとの語形と文法 → 言語ごとの i18n の文言ファイル | `locale/ja.json`・`locale/en.json` を生成。言語を足すときは語形と文法を足す |

単語帳を編集するのは開発者だけ（2026-11-19 決定）。業務の人とは、生成した画面・処理の訳と `pnpm vocabulary:find` で言葉を合わせる。

「独自の定義 → i18n 向けの変換」は作った。一般の i18n のライブラリは「キー → 言語ごとの文字列」を人が書く前提で、言語のあいだで用語がずれても気づけない。ここでは文字列を人が書かず、概念と文法から生成するので、同じ概念はどの画面・どの言語でも同じ語になる。

### 1.1 数（2026-11-19）

| 項目 | 前 | 後 |
| --- | --- | --- |
| 概念 | 単語の表（英単語 → 日本語の文字列） | 290（語形は活用の型から生成） |
| 画面の見出し | 51（うち 9 が英語に1通りに戻らない） | 237。すべて日本語から元の名前に1通りに戻る（往復のテスト） |
| 日本語の訳のかぶり | 同じ品詞で 7 組（請求＝invoice・billing など） | 0（生成のときに止める） |
| 助詞や活用の断片を含む訳 | 形容詞 37 | 0（-able・過去分詞・un- は動詞の活用から作る） |
| 英語・日本語を別々に書いた文 | 並び 34・文 33 | 並び 0（`phrases.yaml` を廃止）、文 31 のうち文の型 10・自由文 21 |

## 2. 仕組み

意味（言語に依らない構造）と、言語ごとの書き方を分ける。考え方は Grammatical Framework（抽象構文と具象構文）や、制御自然言語（決まった語彙と文法だけで書く言語）と同じ。コードの名前は、語彙と文法を絞った「制御された英語」として扱う。

```mermaid
flowchart LR
  W[単語帳<br>words/**/*.yaml<br>messages.yaml] --> C[概念と語形<br>活用の型から生成]
  C --> X[lint<br>名前の検査]
  C --> T[翻訳ツール<br>処理の日本語訳]
  C --> Q[SQL の台帳<br>DB の名前の検査]
  C --> G[生成<br>pnpm vocabulary:generate]
  K[画面のコードのキー<br>text.label・text.action・labelKey] --> G
  G --> J[locale/ja.json]
  G --> E[locale/en.json]
  G --> Y[キーの型<br>LabelKey・ActionKey・MessageKey]
  J --> UI[画面<br>@app/vocabulary/text]
  E --> UI
```

| 層 | 持つもの | 置き場所 |
| --- | --- | --- |
| 概念 | 言語に依らない概念の ID（英語の原形）と品詞。1つの概念は1つの意味 | `words/system/*.yaml`（システム向け）・`words/domain/*.yaml`（業務） |
| 語形 | 言語ごとの最小の情報と活用の型。ほかの語形は文法で作る | 同上の `en: {…}`・`ja: {…}` |
| 文法（言語ごとの書き方） | 名前の読み取り、見出し・ボタン・題・手順・文の組み立て | `src/english.ts`・`src/japanese.ts`・`src/sentence.ts`・`src/morphology.ts` |
| 文 | 文の型（依頼・完了など）と、型に収まらない自由文 | `messages.yaml` |
| 生成物 | 概念の表、言語ごとの文言ファイル、キーの型 | `src/generated/`（手で編集しない。CI で照合） |

### 2.1 概念と語形

```yaml
- { id: amount, ja: { form: 金額, attach: direct } }                 # 前の名詞へ「の」なしでつなぐ（売上金額）
- { id: customer, en: { plural: customers }, ja: { form: 顧客 } }    # 前の名詞へは「の」でつなぐ（振込依頼人の顧客）
- { id: issue, en: { noun: issuance }, ja: { stem: 発行, class: suru } }
- { id: cancel, en: { past: canceled, gerund: canceling, noun: cancellation }, ja: { dictionary: 取り消す, class: godan, noun: 取消 } }
- { id: close, en: { noun: closing }, ja: { dictionary: 締める, class: ichidan, noun: 締め, label: 締め処理 } }
- { id: draft, ja: { stem: 発行前, class: no } }
- { id: billingCustomer, en: { tokens: billing customer }, ja: { form: 請求先 }, description: … }
```

- 英語は原形（`id`）から複数形・三単現・過去形・過去分詞・-ing・-able・un-過去分詞を作り、不規則なものだけ書く。動詞の名詞形（creation・issuance）は見出しに使う。
- 日本語の動詞は活用の型（サ変 `suru`・一段 `ichidan`・五段 `godan`）から、する形・て形・過去・可能・丁寧な過去・否定・完了（発行済み）・未完了（未発行）を作る。
- 日本語の形容詞は型（`no`: 発行前の、`na`: 不正な、`i`: 見つからない、`prefix`: 今回・新）で、名詞の前に付くときの形を決める。
- 派生は語彙でなく文法で作る。cancelable は cancel の可能形（取り消せる）、issued は issue の完了（発行済み）、unissued は未完了（未発行）、unbilled は bill の未完了（請求に載せていない）。
- 部分の組合せで訳が決まらない言い回しは、複合語として1つの概念にする（`billingCustomer` ＝「請求先」）。組合せで決まるもの（売上金額・締めの取消）は書かない。
- 業務の概念は `description` が必須。

### 2.2 一意の検査（全単射）

生成のときに次を検査し、1つでもあれば止める。これで英語と日本語が1対1につながり、日本語から英語の名前へ1通りに戻せる。

- 英語: 同じ語形を2つの概念に当てない。`avoid`（使わせない単語。`add`・`get`・`parse` など）が別の概念の語形になっていない。
- 日本語: 同じ品詞の同じ語形を2つの概念に当てない（「請求」を invoice と billing の両方に当てない）。
- 文言ファイル: 言語ごとに、別の見出しが同じ文字列にならない（"Item" と "Item Name" のようなかぶりを止める）。単数・複数は同じとみなす。
- 往復のテスト（`packages/vocabulary/test/roundTrip.test.ts`）: 生成した日本語の見出し 237 件をすべて日本語の文法で読み戻し、元の名前と同じ概念の並びに1通りに戻ることを確かめる。

### 2.3 組み立て

| 組み立て | 英語 | 日本語 |
| --- | --- | --- |
| 複合（名詞 ＋ 名詞） | sales amount | 売上金額（つなぐ名詞が `attach: direct`）／振込依頼人の顧客（それ以外は「の」） |
| 修飾（形容詞 ＋ 名詞） | draft invoice | 発行前の請求 |
| 関係（名詞 ＋ 前置詞 ＋ 名詞） | customer for sales | 売上用の顧客（前置詞の型 `ja.noun`・`ja.step`・`ja.title`） |
| 動作（動詞 ＋ 対象 ＋ 関係） | find customer by id | ID で顧客を取得する（手順）／ID での顧客の取得（題） |
| 述語（is・has・can） | can cancel closing | 締めを取り消せる |

同じ組み立てから、使い道ごとに文体を変えて作る。

| 使い道 | 英語 | 日本語 | 引き方 |
| --- | --- | --- | --- |
| コードの名前 | camelCase（`issueInvoice`） | 作らない | — |
| 画面の見出し | Title Case の名詞句（Sales Creation・Invoice Number） | 名詞句（売上登録・請求番号） | `text.label('salesCreate')` |
| ボタン | 動詞の命令形（Issue） | 動詞の名詞形（発行） | `text.action('issue')` |
| 関数の題 | — | 体言止め（請求の発行） | 翻訳ツール |
| 処理の手順 | — | する形（請求を発行する） | 翻訳ツール |
| 画面の文 | 文の型ごとの書き方 | 丁寧体 | `text.message('inputRequired', { field })` |

### 2.4 画面の文

文は文の型に当てはめて書く。型ごとに、各言語の書き方を1回だけ決めてある。

```yaml
- { key: inputRequired, frame: request, verb: enter, object: $field }   # {field}を記入してください。／Enter {field}.
- { key: createCompleted, frame: done, verb: create }                   # 登録しました。／Created.
- { key: identifyCompleted, frame: done, verb: identify, object: customer }  # 顧客を特定しました。／Customer identified.
- key: changedTarget                                                    # 型に収まらない文だけ自由文で両方の言語に書く
  free: { ja: 対象がほかの操作で変わりました。もう一度やり直してください。, en: The target was changed by another operation. Please try again. }
```

| 文の型 | 日本語 | 英語 |
| --- | --- | --- |
| `request` | {object}を〜してください。 | Enter {object}. ／ Select {object}. |
| `prompt` | 〜してください（選択肢の先頭など） | Select… |
| `done` | （{object}を）〜しました。 | Created. ／ Customer identified. |
| `progress` | 〜しています… | Loading… |
| `missing` | {object}が見つかりません。 | The {object} was not found. |

自由文は生成のたびに数を出す（いま 21）。増えたら型を足すかを考える。

### 2.5 画面からの使い方

```tsx
import { labelKey, prepareText, type LabelKey } from '@app/vocabulary/text'

const text = prepareText('ja')
text.label('salesAmount')                         // 売上金額
text.action('register')                           // 記録
text.message('invalidRange', { field, minimum, maximum })
const fieldLabels = { salesAmount: labelKey('salesAmount') } satisfies Record<Field, LabelKey>
```

- 画面のコードは文言を直接書かない。`text.label`・`text.action`・`labelKey`・`actionKey` に書いたキーを生成のときに集め、その分だけ文言ファイルに入れる。
- キーは生成した型（`LabelKey`・`ActionKey`・`MessageKey`）で検査する。文言ファイルにないキーは型のエラーになる。
- 言語は `TextProvider` の `locale` で切り替える。言語を足すときは、文言ファイルが1つ増えるだけで、画面のコードは変えない。

### 2.6 日本語から英語の名前を引く

```sh
pnpm vocabulary:find 振込依頼人の顧客      # → payerCustomer
pnpm vocabulary:find 未発行の請求          # → unissuedInvoice
pnpm vocabulary:find 請求に載せていない入金  # → unbilledPayment
```

日本語を、単語帳の日本語の語形で最長一致に分け（つなぎの「の」は読み飛ばす）、概念の並びにして英語の名前を組み立てる。設計書の言葉から名前を決めるときに使う。組み立てられなければ、単語を足すか、言い方を単語帳に合わせる。

## 3. 言語の構造上むずかしいところと扱い

| むずかしいところ | 扱い |
| --- | --- |
| 語順・助詞 | 前置詞の型（名詞句・手順・題の3つ）で並べ替える |
| 名詞のつなぎ方（「の」の有無） | つながれる側の名詞に `attach: direct` を持たせる（金額・番号・日・名・区分・一覧など） |
| 活用 | 活用の型（サ変・五段・一段）から作る。業務の動詞の多くはサ変で、語幹だけで済む |
| 単数・複数 | 日本語は数を表さないので、日本語から戻すと数は分からない。往復の検査・文言のかぶりの検査は原形でそろえて比べる |
| 冠詞（the・a） | 見出しには付けない。文は文の型の書き方で決める |
| 多義語 | 1つの概念は1つの意味。言語ごとの一意の検査で、訳の側の多義も止める（`issue` は「発行」なので、入力の「問題」は `problem`） |
| 型に収まらない文 | 自由文として認め、数を見張る |

## 4. まだしていないこと

- 翻訳ツールで英語の訳（題・手順）も作る。文法（`renderEnglishStep` など）はあるが、出力は日本語だけ。
- 単語帳をファイル名・API のパスにも当てる。
- 3つめの言語。足すときは、その言語の語形の欄・活用の型・文体の規則を足し、往復のテストをその言語でも通す。

## 5. 決めたこと

| 点 | 決定 | 日付 |
| --- | --- | --- |
| 単語帳を誰が編集するか | 開発者だけ | 2026-11-19 |
| 概念の ID | 英語の原形（コードが英語のため） | 2026-11-19 |
| 名詞のつなぎ方 | 直接つなぐ名詞に印（`attach: direct`）、それ以外は「の」 | 2026-11-19 |
| 往復の検査での単数・複数 | 同じとみなす（日本語から数は戻せないため） | 2026-11-19 |
| 型に収まらない文 | 自由文として認め、数を出して見張る | 2026-11-19 |
| i18n | 単語帳から言語ごとの文言ファイルを生成し、画面はそれだけを読む（文言を人が言語ごとに書かない） | 2026-11-19 |
