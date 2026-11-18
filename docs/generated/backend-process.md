# 処理の日本語訳

> 生成物。`pnpm translate` で packages/backend/src の usecase・domain から作る。手で編集しない。

## usecase/customer/listBillingCustomers.ts

### 請求先の一覧取得

- 関数: `listBillingCustomers`
- 目的: 締めの画面で選べる請求先を示すため。
- 引数: リポジトリ
- 処理:

   1. 顧客を一覧取得する
   2. 請求先を選ぶ
   3. 請求先を返す

## usecase/customer/listCustomers.ts

### 顧客の一覧取得

- 関数: `listCustomers`
- 目的: 売上の登録で選べる顧客を示すため。
- 引数: 顧客リポジトリ
- 処理:

   1. 顧客を一覧取得する
   2. 顧客を返す

## usecase/invoice/cancelClosing.ts

### 締めの取消

- 関数: `cancelClosing`
- 目的: 発行前の請求の誤りを直せるよう、締めを取り消して売上・入金などを請求に載せる前へ戻すため。
- 引数: リポジトリ、請求IDテキスト
- 処理:

   1. 請求IDを解釈する
   2. 請求を取得する
   3. 顧客をロックする
   4. 締めの取消ができることを確かめる
   5. 締めの取消を計画する
   6. 締めを取り消す

## usecase/invoice/closeInvoice.ts

### 請求の締め処理

- 関数: `closeInvoice`
- 目的: 請求先の締め日までの売上・入金・返金・調整を、前回からの残高を繰り越した請求にまとめるため。
- 引数: リポジトリ、ID生成器、締めリクエスト
- 処理:

   1. 締めリクエストを解釈する
   2. 顧客をロックする
   3. 最新の請求を取得する
   4. 締められることを確かめる
   5. 請求に載せていない明細を一覧取得する
   6. 請求IDを割り当てる
   7. 請求登録を計画する
   8. 請求を登録する
   9. 請求IDを返す

## usecase/invoice/findInvoiceDetail.ts

### 請求詳細の取得

- 関数: `findInvoiceDetail`
- 目的: 請求書の中身（見出し・税率ごとの合計・載せた売上と入金）を示すため。
- 引数: リポジトリ、請求IDテキスト
- 処理:

   1. 請求IDを解釈する
   2. 請求詳細を取得する
   3. 請求詳細を返す

## usecase/invoice/issueInvoice.ts

### 請求の発行

- 関数: `issueInvoice`
- 目的: 締めた請求に請求番号を振って発行し、以後は変えないようにするため。
- 引数: リポジトリ、発行リクエスト
- 処理:

   1. 発行リクエストを解釈する
   2. 請求を取得する
   3. 発行できることを確かめる
   4. 発行年を読み取る
   5. 請求番号を取り出す
   6. 請求発行を計画する
   7. 請求を発行する
   8. 請求発行の請求番号を返す

## usecase/invoice/listInvoices.ts

### 請求の一覧取得

- 関数: `listInvoices`
- 目的: 締めた請求を、発行の状態と金額とともに示すため。
- 引数: リポジトリ
- 処理:

   1. 請求を一覧取得する
   2. 請求を返す

## usecase/sales/createSales.ts

### 売上の登録

- 関数: `createSales`
- 目的: 顧客への売上を計上するため。
- 引数: 売上リポジトリ、顧客リポジトリ、ID生成器、売上リクエスト
- 処理:

   1. 売上リクエストを解釈する
   2. 顧客を取得する
   3. 売上IDを割り当てる
   4. 売上登録を計画する
   5. 売上を登録する
   6. 売上IDを返す

## domain/adjustment/entity.ts

### 調整の復元

- 関数: `restoreAdjustment`
- 目的: 保存済みの値から調整を組み立てるため。保存済みの値は DB の制約で検証済みとして扱う。
- 引数: 保存形の
- 処理:

   1. 保存形のを返す

## domain/customer/billingKnowledge.ts

### 請求先の判定

- 関数: `isBillingCustomer`
- 目的: 請求先（請求書を受け取り、入金する顧客）かどうか。請求先は自分自身を請求先に持つ。
- 引数: 顧客
- 処理:

   1. `customer.billingCustomerId === customer.customerId`を返す

### 請求先の選択

- 関数: `selectBillingCustomers`
- 目的: 締めの画面で選べる請求先を示すため。
- 引数: 顧客
- 処理:

   1. `customers.filter(isBillingCustomer)`を返す

## domain/customer/entity.ts

### 顧客の復元

- 関数: `restoreCustomer`
- 目的: 保存済みの値から顧客を組み立てるため。保存済みの値は DB の制約で検証済みとして扱う。
- 引数: 保存形の
- 処理:

   1. 保存形のを返す

## domain/customer/value/customerId.ts

### 顧客IDの解釈

- 関数: `interpretCustomerId`
- 目的: 画面で選んだ顧客を、顧客 ID として受け付けるため。
- 引数: テキスト
- 処理:

   1. テキストが空である場合
      1. エラー「{field}を選んでください。」で止める
   2. テキストを返す

## domain/invoice/closingCancel.ts

### 締めの取消ができることの確認

- 関数: `ensureClosingCancelable`
- 目的: 締めを取り消してよいかを確かめるため。発行した請求は取り消さない（訂正は次の請求で行う）。
次の締めは前回の発行を求めるので、発行前の請求はいつもその請求先の最新の請求になる。
- 引数: 請求
- 処理:

   1. 請求の発行日が空でない場合
      1. エラー「この請求はすでに発行されています。発行した請求は変えず、訂正は次の請求で行ってください。」で止める

### 締めの取消の計画

- 関数: `planClosingCancel`
- 引数: 請求
- 処理:

   1. `{ invoiceId: invoice.invoiceId }`を返す

## domain/invoice/closingPolicy.ts

### の締日の判定

- 関数: `isClosingDayOf`
- 目的: 請求締め日が、請求先の締日（31 は月末。その月にない日も月末）に合うかどうか。
- 引数: 顧客、請求締め日
- 処理:

   1. 日付を分ける
   2. `placeMonthDay(closingParts.year, closingParts.month, customer.closingDay) === closingDate`を返す

### 締められることの確認

- 関数: `ensureClosable`
- 目的: 締めてよいかを確かめるため。
請求先であること、締め日が請求先の締日に合うこと、前回の請求が発行済みで、締め日が前回より後であること。
- 引数: 請求先、最新の請求、締め入力
- 処理:

   1. 請求先でない場合
      1. エラー（`rejectField('billingCustomerId', 'billingCustomerRequired')`）で止める
   2. の締日でない場合
      1. エラー（`billingCustomer.closingDay === 31 ? rejectField('closingDate', 'monthEndRequired') : rejectField('closingDate', 'closingDayRequired', { closingDay: billingCustomer.closingDay })`）で止める
   3. 最新の請求が空である場合
      1. 終える
   4. 最新の請求の発行日が空である場合
      1. エラー「前回の請求がまだ発行されていません。発行してから締めてください。」で止める
   5. より前の日付でない場合
      1. エラー（`rejectField('closingDate', 'earlyClosingDate', { previousDate: latestInvoice.closingDate })`）で止める

## domain/invoice/closingRequest.ts

### 締めリクエストの解釈

- 関数: `interpretClosingRequest`
- 目的: 画面の入力を、締めに使える値にそろえるため。
- 引数: 締めリクエスト
- 処理:

   1. 項目を解釈する（その結果を返す）

## domain/invoice/entity.ts

### 請求の復元

- 関数: `restoreInvoice`
- 目的: 保存済みの値から請求を組み立てるため。保存済みの値は DB の制約で検証済みとして扱う。
- 引数: 保存形の
- 処理:

   1. 保存形のを返す

### 請求一覧品目の復元

- 関数: `restoreInvoiceListItem`
- 目的: 保存済みの値から一覧の請求を組み立てるため。
- 引数: 保存形の
- 処理:

   1. 保存形のを返す

### 請求税の復元

- 関数: `restoreInvoiceTax`
- 目的: 保存済みの値から税率ごとの合計を組み立てるため。
- 引数: 保存形の
- 処理:

   1. 保存形のを返す

## domain/invoice/invoiceCreate.ts

### 請求登録の計画

- 関数: `planInvoiceCreate`
- 目的: 前回の請求と、請求締め日までに載せていない行から、請求の金額を決めるため（残高を繰り越す請求書）。
今回入金額は入金から返金を引いた額。繰越額が負なら前受として次へ繰り越す。
- 引数: 請求ID、請求先、最新の請求、締め入力、請求に載せていない明細
- 処理:

   1. 空の締めである場合
      1. エラー「締める対象（前回からの残高・売上・入金・返金・調整）がありません。」で止める
   2. 前回金額を`latestInvoice?.invoiceAmount ?? 0`にする
   3. 入金額を`sumYen(unbilledEntries.payments.map((payment) => payment.paymentAmount)) - sumYen(unbilledEntries.refunds.map((refund) => refund.refundAmount))`にする
   4. 円を合計する
   5. 繰越額を`previousAmount - paymentAmount - adjustmentAmount`にする
   6. 請求税を計算する
   7. 円を合計する
   8. 円を合計する
   9. 請求を`{ invoiceId, billingCustomerId: billingCustomer.customerId, previousInvoiceId: latestInvoice?.invoiceId ?? null, closingDate: closingInput.closingDate, dueDate: decideDueDate(closingInput.closingDate, billingCustomer.collectionMonthOffset, billingCustomer.collectionDay), previousAmount, paymentAmount, adjustmentAmount, carriedAmount, salesAmount, taxAmount, invoiceAmount: (carriedAmount + salesAmount + taxAmount) as Yen, invoiceNumber: null, issueDate: null, }`にする
   10. 請求登録を`{ invoice, taxes, salesIds: unbilledEntries.sales.map((sales) => sales.salesId), paymentIds: unbilledEntries.payments.map((payment) => payment.paymentId), refundIds: unbilledEntries.refunds.map((refund) => refund.refundId), adjustmentIds: unbilledEntries.adjustments.map((adjustment) => adjustment.adjustmentId), }`にする
   11. 請求登録を返す

## domain/invoice/invoiceIssue.ts

### 発行できることの確認

- 関数: `ensureIssuable`
- 目的: 発行してよいかを確かめるため。発行前で、発行日が請求締め日以後であること。
- 引数: 請求、発行入力
- 処理:

   1. 請求の発行日が空でない場合
      1. エラー「この請求はすでに発行されています。発行した請求は変えず、訂正は次の請求で行ってください。」で止める
   2. より前の日付である場合
      1. エラー（`rejectField('issueDate', 'earlyIssueDate', { closingDate: invoice.closingDate })`）で止める

### 請求発行の計画

- 関数: `planInvoiceIssue`
- 目的: 発行日の年の通し番号から、請求番号を決めるため。
- 引数: 請求、発行入力、最終番号
- 処理:

   1. `{ invoiceId: invoice.invoiceId, invoiceNumber: composeInvoiceNumber(readIssueYear(issueInput.issueDate), lastNumber), issueDate: issueInput.issueDate, }`を返す

## domain/invoice/invoiceTaxKnowledge.ts

### 請求税の計算

- 関数: `calculateInvoiceTaxes`
- 目的: 請求の税率ごとの合計と消費税額を求めるため（インボイス制度）。
税抜の売上を税率ごとに合計し、税率をかけて 1円未満を 0 の方へ切り捨てる。売上のない税率は出さない。
- 引数: 請求ID、売上
- 処理:

   1. `taxRates.flatMap((taxRate) => { const rateSales = sales.filter((item) => item.taxRate === taxRate) if (rateSales.length === 0) { return [] } const taxableAmount = sumYen(rateSales.map((item) => item.salesAmount)) const taxAmount = Math.trunc((taxableAmount * taxRate) / 100) as Yen return [{ invoiceId, taxRate, taxableAmount, taxAmount }] })`を返す

## domain/invoice/issueRequest.ts

### 発行リクエストの解釈

- 関数: `interpretIssueRequest`
- 目的: 画面の入力を、発行に使える値にそろえるため。
- 引数: 発行リクエスト
- 処理:

   1. 項目を解釈する（その結果を返す）

## domain/invoice/value/closingDate.ts

### 請求締め日の解釈

- 関数: `interpretClosingDate`
- 目的: 画面から入力された日付を、請求締め日として受け付けるため。
- 引数: テキスト
- 処理:

   1. 日付テキストを解釈する（その結果を返す）

## domain/invoice/value/dueDate.ts

### 入金期日の決定

- 関数: `decideDueDate`
- 目的: 請求締め日と請求先の回収条件から、入金期日を決めるため。
回収日 31 や、その月にない日は月末にする。締め日より前になるとき（当月回収で回収日が締め日より前）は翌月にする。
- 引数: 請求締め日、回収月、回収日
- 処理:

   1. 日付を分ける
   2. 月をずらす
   3. 月日を当てはめる
   4. より前の日付でない場合
      1. 入金期日を返す
   5. 月をずらす
   6. 月日を当てはめる（その結果を返す）

## domain/invoice/value/invoiceId.ts

### 請求IDの割り当て

- 関数: `assignInvoiceId`
- 目的: 新しい請求に ID を割り当てるため。
- 引数: ID生成器
- 処理:

   1. IDを生成する（その結果を返す）

### 請求IDの解釈

- 関数: `interpretInvoiceId`
- 目的: 画面の URL などから届いた請求の ID を受け付けるため。
- 引数: テキスト
- 処理:

   1. テキストが空である場合
      1. エラー「{field}を入力してください。」で止める
   2. テキストを返す

## domain/invoice/value/invoiceNumber.ts

### 請求番号の組み立て

- 関数: `composeInvoiceNumber`
- 目的: 発行した年と、その年の通し番号から、請求番号を作るため。
- 引数: 発行年、最終番号
- 処理:

   1. ``${issueYear}-${String(lastNumber).padStart(6, '0')}``を返す

## domain/invoice/value/issueDate.ts

### 発行日の解釈

- 関数: `interpretIssueDate`
- 目的: 画面から入力された日付を、発行日として受け付けるため。
- 引数: テキスト
- 処理:

   1. 日付テキストを解釈する（その結果を返す）

### 発行年の読み取り

- 関数: `readIssueYear`
- 目的: 請求番号を振る年を決めるため。
- 引数: 発行日
- 処理:

   1. `splitDate(issueDate)`の年を返す

## domain/payment/entity.ts

### 入金の復元

- 関数: `restorePayment`
- 目的: 保存済みの値から入金を組み立てるため。保存済みの値は DB の制約で検証済みとして扱う。
- 引数: 保存形の
- 処理:

   1. 保存形のを返す

## domain/refund/entity.ts

### 返金の復元

- 関数: `restoreRefund`
- 目的: 保存済みの値から返金を組み立てるため。保存済みの値は DB の制約で検証済みとして扱う。
- 引数: 保存形の
- 処理:

   1. 保存形のを返す

## domain/sales/entity.ts

### 売上の復元

- 関数: `restoreSales`
- 目的: 保存済みの値から売上を組み立てるため。保存済みの値は DB の制約で検証済みとして扱う。
- 引数: 保存形の
- 処理:

   1. 保存形のを返す

## domain/sales/salesCreate.ts

### 売上登録の計画

- 関数: `planSalesCreate`
- 目的: 検証済みの入力と確かめた顧客から、保存する売上を決めるため。返品・値引は金額を負にする。
- 引数: 売上ID、顧客、売上入力
- 処理:

   1. 売上金額を`salesInput.salesKind === 'normal' ? salesInput.salesAmount : (-salesInput.salesAmount as SalesAmount)`にする
   2. `{ salesId, customerId: customer.customerId, salesDate: salesInput.salesDate, salesKind: salesInput.salesKind, itemName: salesInput.itemName, salesAmount, taxRate: salesInput.taxRate, }`を返す

## domain/sales/salesRequest.ts

### 売上リクエストの解釈

- 関数: `interpretSalesRequest`
- 目的: 画面の入力を、売上として扱える値にそろえるため。
- 引数: 売上リクエスト
- 処理:

   1. 項目を解釈する（その結果を返す）

## domain/sales/value/itemName.ts

### 品名の解釈

- 関数: `interpretItemName`
- 目的: 画面から入力された品名を受け付けるため。
- 引数: テキスト
- 処理:

   1. 前後の空白を除いたテキストを`text.trim()`で求める
   2. 前後の空白を除いたテキストが空である場合
      1. エラー「{field}を入力してください。」で止める
   3. `[...trimmedText]`の長さが最大品名長さより大きい場合
      1. エラー「{field}は{maximum}文字以内で入力してください。」で止める
   4. 前後の空白を除いたテキストを返す

## domain/sales/value/salesAmount.ts

### 売上金額の解釈

- 関数: `interpretSalesAmount`
- 目的: 画面から入力された金額（返品・値引も正で入力する）を、売上の金額として受け付けるため。
- 引数: テキスト
- 処理:

   1. 前後の空白を除いたテキストを`text.trim()`で求める
   2. 前後の空白を除いたテキストが空である場合
      1. エラー「{field}を入力してください。」で止める
   3. `/^\d+$/.test(trimmedText)`が偽である場合
      1. エラー「{field}は整数で入力してください。」で止める
   4. 金額を`Number(trimmedText)`で求める
   5. 金額が最小売上金額より小さい、または金額が最大売上金額より大きい場合
      1. エラー「{field}は{minimum}から{maximum}までで入力してください。」で止める
   6. 金額を返す

## domain/sales/value/salesDate.ts

### 売上日の解釈

- 関数: `interpretSalesDate`
- 目的: 画面から入力された日付を、売上日として受け付けるため。
- 引数: テキスト
- 処理:

   1. 日付テキストを解釈する（その結果を返す）

## domain/sales/value/salesId.ts

### 売上IDの割り当て

- 関数: `assignSalesId`
- 目的: 新しい売上に ID を割り当てるため。
- 引数: ID生成器
- 処理:

   1. IDを生成する（その結果を返す）

## domain/sales/value/salesKind.ts

### 売上区分の解釈

- 関数: `interpretSalesKind`
- 目的: 画面で選んだ区分を、売上区分として受け付けるため。
- 引数: テキスト
- 処理:

   1. 売上区分を取得する
   2. 売上区分が空である場合
      1. エラー「{field}を選んでください。」で止める
   3. 売上区分を返す

## domain/sales/value/taxRate.ts

### 税率の解釈

- 関数: `interpretTaxRate`
- 目的: 画面で選んだ税率を受け付けるため。
- 引数: テキスト
- 処理:

   1. 税率を取得する
   2. 税率が空である場合
      1. エラー「{field}を選んでください。」で止める
   3. 税率を返す

## domain/shared/calendar.ts

### 暦日付の判定

- 関数: `isCalendarDate`
- 目的: YYYY-MM-DD の形で、暦に実在する日付かどうか。
- 引数: テキスト
- 処理:

   1. 一致したを`/^(\d{4})-(\d{2})-(\d{2})$/.exec(text)`で求める
   2. 一致したが空である場合
      1. `false`を返す
   3. 年を`Number(matched[1])`で求める
   4. 月を`Number(matched[2])`で求める
   5. 日を`Number(matched[3])`で求める
   6. 日付を`new Date(Date.UTC(year, month - 1, day))`で求める
   7. `date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day`を返す

### 日付の分割

- 関数: `splitDate`
- 目的: 検証済みの YYYY-MM-DD を、年・月・日に分ける。
- 引数: テキスト
- 処理:

   1. `[year = 0, month = 0, day = 0]`を`text.split('-').map(Number)`で求める
   2. 年・月・日を返す

### 日付の組み立て

- 関数: `composeDate`
- 目的: 年・月・日を YYYY-MM-DD にする。
- 引数: 部分
- 処理:

   1. ``${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}``を返す

### 月長さの測定

- 関数: `measureMonthLength`
- 目的: その月の日数（うるう年の2月は29）。
- 引数: 年、月
- 処理:

   1. `new Date(Date.UTC(year, month, 0)).getUTCDate()`を返す

### 月のずらし

- 関数: `shiftMonth`
- 目的: 年・月を、月数だけ後へずらす。
- 引数: 年、月、月数
- 処理:

   1. 位置を`year * 12 + (month - 1) + offset`にする
   2. `{ year: Math.floor(index / 12), month: (index % 12) + 1 }`を返す

### 月日の当てはめ

- 関数: `placeMonthDay`
- 目的: 月の中の日（1〜31。31 は月末）を、その年・月の日付にする。その月にない日（2月30日など）も月末にする。
締日・回収日を実際の日付にするときに使う。
- 引数: 年、月、月日
- 処理:

   1. 日付を組み立てる（その結果を返す）

### より前の日付の判定

- 関数: `isEarlierDate`
- 目的: 日付（YYYY-MM-DD）の前後を比べる。left が right より前の日付なら true。
- 引数: 左の、右の
- 処理:

   1. `left < right`を返す

## domain/shared/dateValue.ts

### 日付テキストの解釈

- 関数: `interpretDateText`
- 目的: 画面から入力された日付の文字列を、YYYY-MM-DD の実在する日付として受け付けるため。値の型は呼び出し側で決める。
- 引数: テキスト
- 処理:

   1. 前後の空白を除いたテキストを`text.trim()`で求める
   2. 前後の空白を除いたテキストが空である場合
      1. エラー「{field}を入力してください。」で止める
   3. 暦日付でない場合
      1. エラー「{field}は実在する日付を YYYY-MM-DD の形で入力してください。」で止める
   4. 前後の空白を除いたテキストを返す

## domain/shared/validation.ts

### 値の拒否

- 関数: `rejectValue`
- 目的: 1つの値を受け付けないことを表すため。項目名は interpretFields が付ける。
- 引数: メッセージキー、値
- 処理:

   1. `new ValidationError([{ field: '', messageKey, params }])`を返す

### 項目の拒否

- 関数: `rejectField`
- 目的: 値そのものは正しいが、ほかの値との組合せで受け付けない項目を表すため。
- 引数: 項目、メッセージキー、値
- 処理:

   1. `new ValidationError([{ field, messageKey, params }])`を返す

### 項目の解釈

- 関数: `interpretFields`
- 目的: 項目ごとの解釈をすべて行い、受け付けない項目をまとめて画面へ返すため。
- 引数: 解釈器
- 処理:

   1. 結果を`{}`にする
   2. 問題を`[]`にする
   3. `Object.keys(interpreters)`の1件ごとに
      1. `try { result[field] = interpreters[field]() } catch (error) { if (!(error instanceof ValidationError)) { throw error } problems.push(...error.problems.map((problem) => ({ ...problem, field: problem.field === '' ? field : `${field}.${problem.field}` }))) }`
   4. 問題の長さが0より大きい場合
      1. エラー（`new ValidationError(problems)`）で止める
   5. 結果を返す

## domain/shared/yen.ts

### 円の合計

- 関数: `sumYen`
- 目的: 金額を合計する。
- 引数: 金額
- 処理:

   1. `amounts.reduce((total, amount) => total + amount, 0)`を返す
