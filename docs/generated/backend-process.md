# 処理の日本語訳

> 生成物。`pnpm translate` で packages/backend/src の usecase・domain から作る。手で編集しない。

## usecase/customer/listBillingCustomers.ts

### 請求先の一覧取得

- 関数: `listBillingCustomers`
- 引数: リポジトリ
- 処理:

   1. 顧客を一覧取得する
   2. 請求先を選ぶ
   3. 請求先を返す

## usecase/customer/listCustomers.ts

### 顧客の一覧取得

- 関数: `listCustomers`
- 引数: 顧客リポジトリ
- 処理:

   1. 顧客を一覧取得する
   2. 顧客を返す

## usecase/invoice/cancelClosing.ts

### 締めの取消

- 関数: `cancelClosing`
- 引数: リポジトリ、請求IDテキスト
- 処理:

   1. 請求IDを解釈する
   2. 請求を取得する
   3. 顧客をロックする
   4. 締めを取り消せることを確かめる
   5. 締めの取消を計画する
   6. 締めを取り消す

## usecase/invoice/closeInvoice.ts

### 請求の締め

- 関数: `closeInvoice`
- 引数: リポジトリ、ID生成器、締めリクエスト
- 処理:

   1. 締めリクエストを解釈する
   2. 顧客をロックする
   3. 最新の請求を取得する
   4. 締められるを確かめる
   5. 請求に載せていない明細を一覧取得する
   6. 請求IDを割り当てる
   7. 請求登録を計画する
   8. 請求を登録する
   9. 請求IDを返す

## usecase/invoice/findInvoiceDetail.ts

### 請求詳細の取得

- 関数: `findInvoiceDetail`
- 引数: リポジトリ、請求IDテキスト
- 処理:

   1. 請求IDを解釈する
   2. 請求詳細を取得する
   3. 請求詳細を返す

## usecase/invoice/issueInvoice.ts

### 請求の発行

- 関数: `issueInvoice`
- 引数: リポジトリ、発行リクエスト
- 処理:

   1. 発行リクエストを解釈する
   2. 請求を取得する
   3. 発行できるを確かめる
   4. 発行年を読み取る
   5. 請求番号を取り出す
   6. 請求発行を計画する
   7. 請求を発行する
   8. 請求発行の請求番号を返す

## usecase/invoice/listInvoices.ts

### 請求の一覧取得

- 関数: `listInvoices`
- 引数: リポジトリ
- 処理:

   1. 請求を一覧取得する
   2. 請求を返す

## usecase/payment/identifyPayment.ts

### 入金の特定

- 関数: `identifyPayment`
- 引数: リポジトリ、特定リクエスト
- 処理:

   1. 特定リクエストを解釈する
   2. 入金を取得する
   3. 顧客を取得する
   4. 入金を特定できることを確かめる
   5. 入金特定を計画する
   6. 入金を特定する
   7. 振込依頼人名保存を計画する
   8. 振込依頼人名を保存する

## usecase/payment/listPayments.ts

### 入金の一覧取得

- 関数: `listPayments`
- 引数: リポジトリ
- 処理:

   1. 入金を一覧取得する
   2. 入金を返す

## usecase/payment/registerPayment.ts

### 入金の記録

- 関数: `registerPayment`
- 引数: リポジトリ、ID生成器、入金リクエスト
- 処理:

   1. 入金リクエストを解釈する
   2. 選んだ顧客を取得する
   3. 振込依頼人の顧客を取得する
   4. 入金の顧客を決める
   5. 入金IDを割り当てる
   6. 入金登録を計画する
   7. 入金を登録する
   8. 振込依頼人名保存を計画する
   9. 振込依頼人名を保存する
   10. 入金登録を返す

## usecase/sales/createSales.ts

### 売上の登録

- 関数: `createSales`
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
- 引数: 保存形
- 処理:

   1. 保存形を返す

## domain/customer/billingKnowledge.ts

### 請求先の判定

- 関数: `isBillingCustomer`
- 引数: 顧客
- 処理:

   1. `customer.billingCustomerId === customer.customerId`を返す

### 請求先の選択

- 関数: `selectBillingCustomers`
- 引数: 顧客
- 処理:

   1. `customers.filter(isBillingCustomer)`を返す

## domain/customer/entity.ts

### 顧客の復元

- 関数: `restoreCustomer`
- 引数: 保存形
- 処理:

   1. 保存形を返す

## domain/customer/value/customerId.ts

### 顧客IDの解釈

- 関数: `interpretCustomerId`
- 引数: テキスト
- 処理:

   1. テキストが空である場合
      1. エラー「{field}を選んでください。」で止める
   2. テキストを返す

## domain/invoice/closingCancel.ts

### 締めを取り消せることの確認

- 関数: `ensureClosingCancelable`
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
- 引数: 顧客、請求締め日
- 処理:

   1. 日付を分ける
   2. `placeMonthDay(closingParts.year, closingParts.month, customer.closingDay) === closingDate`を返す

### 締められるの確認

- 関数: `ensureClosable`
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
- 引数: 締めリクエスト
- 処理:

   1. 項目を解釈する（その結果を返す）

## domain/invoice/entity.ts

### 請求の復元

- 関数: `restoreInvoice`
- 引数: 保存形
- 処理:

   1. 保存形を返す

### 請求一覧の品目の復元

- 関数: `restoreInvoiceListItem`
- 引数: 保存形
- 処理:

   1. 保存形を返す

### 請求の税の復元

- 関数: `restoreInvoiceTax`
- 引数: 保存形
- 処理:

   1. 保存形を返す

## domain/invoice/invoiceCreate.ts

### 請求登録の計画

- 関数: `planInvoiceCreate`
- 引数: 請求ID、請求先、最新の請求、締め入力、請求に載せていない明細
- 処理:

   1. 空の締めである場合
      1. エラー「締める対象（前回からの残高・売上・入金・返金・調整）がありません。」で止める
   2. 前回金額を`latestInvoice?.invoiceAmount ?? 0`にする
   3. 入金額を`sumYen(unbilledEntries.payments.map((payment) => payment.paymentAmount)) - sumYen(unbilledEntries.refunds.map((refund) => refund.refundAmount))`にする
   4. 円を合計する
   5. 繰越額を`previousAmount - paymentAmount - adjustmentAmount`にする
   6. 請求の税を計算する
   7. 円を合計する
   8. 円を合計する
   9. 請求を`{ invoiceId, billingCustomerId: billingCustomer.customerId, previousInvoiceId: latestInvoice?.invoiceId ?? null, closingDate: closingInput.closingDate, dueDate: decideDueDate(closingInput.closingDate, billingCustomer.collectionMonthOffset, billingCustomer.collectionDay), previousAmount, paymentAmount, adjustmentAmount, carriedAmount, salesAmount, taxAmount, invoiceAmount: (carriedAmount + salesAmount + taxAmount) as Yen, invoiceNumber: null, issueDate: null, }`にする
   10. 請求登録を`{ invoice, taxes, salesIds: unbilledEntries.sales.map((sales) => sales.salesId), paymentIds: unbilledEntries.payments.map((payment) => payment.paymentId), refundIds: unbilledEntries.refunds.map((refund) => refund.refundId), adjustmentIds: unbilledEntries.adjustments.map((adjustment) => adjustment.adjustmentId), }`にする
   11. 請求登録を返す

## domain/invoice/invoiceIssue.ts

### 発行できるの確認

- 関数: `ensureIssuable`
- 引数: 請求、発行入力
- 処理:

   1. 請求の発行日が空でない場合
      1. エラー「この請求はすでに発行されています。発行した請求は変えず、訂正は次の請求で行ってください。」で止める
   2. より前の日付である場合
      1. エラー（`rejectField('issueDate', 'earlyIssueDate', { closingDate: invoice.closingDate })`）で止める

### 請求発行の計画

- 関数: `planInvoiceIssue`
- 引数: 請求、発行入力、最終番号
- 処理:

   1. `{ invoiceId: invoice.invoiceId, invoiceNumber: composeInvoiceNumber(readIssueYear(issueInput.issueDate), lastNumber), issueDate: issueInput.issueDate, }`を返す

## domain/invoice/invoiceTaxKnowledge.ts

### 請求の税の計算

- 関数: `calculateInvoiceTaxes`
- 引数: 請求ID、売上
- 処理:

   1. `taxRates.flatMap((taxRate) => { const rateSales = sales.filter((item) => item.taxRate === taxRate) if (rateSales.length === 0) { return [] } const taxableAmount = sumYen(rateSales.map((item) => item.salesAmount)) const taxAmount = Math.trunc((taxableAmount * taxRate) / 100) as Yen return [{ invoiceId, taxRate, taxableAmount, taxAmount }] })`を返す

## domain/invoice/issueRequest.ts

### 発行リクエストの解釈

- 関数: `interpretIssueRequest`
- 引数: 発行リクエスト
- 処理:

   1. 項目を解釈する（その結果を返す）

## domain/invoice/value/closingDate.ts

### 請求締め日の解釈

- 関数: `interpretClosingDate`
- 引数: テキスト
- 処理:

   1. 日付テキストを解釈する（その結果を返す）

## domain/invoice/value/dueDate.ts

### 入金期日の決定

- 関数: `decideDueDate`
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
- 引数: ID生成器
- 処理:

   1. IDを生成する（その結果を返す）

### 請求IDの解釈

- 関数: `interpretInvoiceId`
- 引数: テキスト
- 処理:

   1. テキストが空である場合
      1. エラー「{field}を記入してください。」で止める
   2. テキストを返す

## domain/invoice/value/invoiceNumber.ts

### 請求番号の組み立て

- 関数: `composeInvoiceNumber`
- 引数: 発行年、最終番号
- 処理:

   1. ``${issueYear}-${String(lastNumber).padStart(6, '0')}``を返す

## domain/invoice/value/issueDate.ts

### 発行日の解釈

- 関数: `interpretIssueDate`
- 引数: テキスト
- 処理:

   1. 日付テキストを解釈する（その結果を返す）

### 発行年の読み取り

- 関数: `readIssueYear`
- 引数: 発行日
- 処理:

   1. `splitDate(issueDate)`の年を返す

## domain/payerName/payerNameSave.ts

### 振込依頼人名保存の計画

- 関数: `planPayerNameSaves`
- 引数: 振込依頼人名、選んだ顧客
- 処理:

   1. 選んだ顧客が空である場合
      1. `[]`を返す
   2. `[{ payerName, customerId: selectedCustomer.customerId } as PayerNameSave]`を返す

## domain/payment/entity.ts

### 入金の復元

- 関数: `restorePayment`
- 引数: 保存形
- 処理:

   1. 保存形を返す

### 入金一覧の品目の復元

- 関数: `restorePaymentListItem`
- 引数: 保存形
- 処理:

   1. 保存形を返す

## domain/payment/identifyRequest.ts

### 特定リクエストの解釈

- 関数: `interpretIdentifyRequest`
- 引数: 特定リクエスト
- 処理:

   1. 項目を解釈する（その結果を返す）

## domain/payment/payerPolicy.ts

### 入金の顧客の決定

- 関数: `decidePaymentCustomer`
- 引数: 選んだ顧客、振込依頼人の顧客
- 処理:

   1. 選んだ顧客が空でない場合
      1. 請求先でない場合
         1. エラー（`rejectField('customerId', 'billingCustomerRequired')`）で止める
      2. 選んだ顧客の顧客IDを返す
   2. `payerCustomer?.customerId ?? null`を返す

### 入金を特定できることの確認

- 関数: `ensurePaymentIdentifiable`
- 引数: 入金、顧客
- 処理:

   1. 入金の顧客IDが空でない、または入金の請求IDが空でない場合
      1. エラー「この入金はすでに顧客を特定済みか、請求に載せています。」で止める
   2. 請求先でない場合
      1. エラー（`rejectField('customerId', 'billingCustomerRequired')`）で止める

## domain/payment/paymentCreate.ts

### 入金登録の計画

- 関数: `planPaymentCreate`
- 引数: 入金ID、入金入力、顧客ID
- 処理:

   1. `{ paymentId, paymentDate: paymentInput.paymentDate, paymentMethod: paymentInput.paymentMethod, paymentAmount: paymentInput.paymentAmount, payerName: paymentInput.payerName, customerId, }`を返す

## domain/payment/paymentIdentify.ts

### 入金特定の計画

- 関数: `planPaymentIdentify`
- 引数: 入金、顧客
- 処理:

   1. `{ paymentId: payment.paymentId, customerId: customer.customerId }`を返す

## domain/payment/paymentRequest.ts

### 入金リクエストの解釈

- 関数: `interpretPaymentRequest`
- 引数: 入金リクエスト
- 処理:

   1. 項目を解釈する（その結果を返す）

## domain/payment/value/payerName.ts

### 振込依頼人名の正規化

- 関数: `normalizePayerName`
- 引数: テキスト
- 処理:

   1. `text.normalize('NFKC').trim().replace(/\s+/g, ' ')`を返す

### 振込依頼人名の解釈

- 関数: `interpretPayerName`
- 引数: テキスト
- 処理:

   1. 振込依頼人名を正規化する
   2. 正規化済みのテキストが空である場合
      1. エラー「{field}を記入してください。」で止める
   3. `[...normalizedText]`の長さが最大振込依頼人名の長さより大きい場合
      1. エラー「{field}は{maximum}文字以内で記入してください。」で止める
   4. 正規化済みのテキストを返す

## domain/payment/value/paymentAmount.ts

### 入金額の解釈

- 関数: `interpretPaymentAmount`
- 引数: テキスト
- 処理:

   1. テキストを前後の空白を除く
   2. 前後の空白を除いたテキストが空である場合
      1. エラー「{field}を記入してください。」で止める
   3. `/^\d+$/.test(trimmedText)`が偽である場合
      1. エラー「{field}は整数で記入してください。」で止める
   4. 金額を`Number(trimmedText)`で求める
   5. 金額が最小入金額より小さい、または金額が最大入金額より大きい場合
      1. エラー「{field}は{minimum}から{maximum}までで記入してください。」で止める
   6. 金額を返す

## domain/payment/value/paymentDate.ts

### 入金日の解釈

- 関数: `interpretPaymentDate`
- 引数: テキスト
- 処理:

   1. 日付テキストを解釈する（その結果を返す）

## domain/payment/value/paymentId.ts

### 入金IDの割り当て

- 関数: `assignPaymentId`
- 引数: ID生成器
- 処理:

   1. IDを生成する（その結果を返す）

### 入金IDの解釈

- 関数: `interpretPaymentId`
- 引数: テキスト
- 処理:

   1. テキストが空である場合
      1. エラー「{field}を記入してください。」で止める
   2. テキストを返す

## domain/payment/value/paymentMethod.ts

### 入金方法の解釈

- 関数: `interpretPaymentMethod`
- 引数: テキスト
- 処理:

   1. 入金方法を取得する
   2. 入金方法が空である場合
      1. エラー「{field}を選んでください。」で止める
   3. 入金方法を返す

## domain/refund/entity.ts

### 返金の復元

- 関数: `restoreRefund`
- 引数: 保存形
- 処理:

   1. 保存形を返す

## domain/sales/entity.ts

### 売上の復元

- 関数: `restoreSales`
- 引数: 保存形
- 処理:

   1. 保存形を返す

## domain/sales/salesCreate.ts

### 売上登録の計画

- 関数: `planSalesCreate`
- 引数: 売上ID、顧客、売上入力
- 処理:

   1. 売上金額を`salesInput.salesKind === 'normal' ? salesInput.salesAmount : (-salesInput.salesAmount as SalesAmount)`にする
   2. `{ salesId, customerId: customer.customerId, salesDate: salesInput.salesDate, salesKind: salesInput.salesKind, itemName: salesInput.itemName, salesAmount, taxRate: salesInput.taxRate, }`を返す

## domain/sales/salesRequest.ts

### 売上リクエストの解釈

- 関数: `interpretSalesRequest`
- 引数: 売上リクエスト
- 処理:

   1. 項目を解釈する（その結果を返す）

## domain/sales/value/itemName.ts

### 品名の解釈

- 関数: `interpretItemName`
- 引数: テキスト
- 処理:

   1. テキストを前後の空白を除く
   2. 前後の空白を除いたテキストが空である場合
      1. エラー「{field}を記入してください。」で止める
   3. `[...trimmedText]`の長さが最大品名の長さより大きい場合
      1. エラー「{field}は{maximum}文字以内で記入してください。」で止める
   4. 前後の空白を除いたテキストを返す

## domain/sales/value/salesAmount.ts

### 売上金額の解釈

- 関数: `interpretSalesAmount`
- 引数: テキスト
- 処理:

   1. テキストを前後の空白を除く
   2. 前後の空白を除いたテキストが空である場合
      1. エラー「{field}を記入してください。」で止める
   3. `/^\d+$/.test(trimmedText)`が偽である場合
      1. エラー「{field}は整数で記入してください。」で止める
   4. 金額を`Number(trimmedText)`で求める
   5. 金額が最小売上金額より小さい、または金額が最大売上金額より大きい場合
      1. エラー「{field}は{minimum}から{maximum}までで記入してください。」で止める
   6. 金額を返す

## domain/sales/value/salesDate.ts

### 売上日の解釈

- 関数: `interpretSalesDate`
- 引数: テキスト
- 処理:

   1. 日付テキストを解釈する（その結果を返す）

## domain/sales/value/salesId.ts

### 売上IDの割り当て

- 関数: `assignSalesId`
- 引数: ID生成器
- 処理:

   1. IDを生成する（その結果を返す）

## domain/sales/value/salesKind.ts

### 売上区分の解釈

- 関数: `interpretSalesKind`
- 引数: テキスト
- 処理:

   1. 売上区分を取得する
   2. 売上区分が空である場合
      1. エラー「{field}を選んでください。」で止める
   3. 売上区分を返す

## domain/sales/value/taxRate.ts

### 税率の解釈

- 関数: `interpretTaxRate`
- 引数: テキスト
- 処理:

   1. 税率を取得する
   2. 税率が空である場合
      1. エラー「{field}を選んでください。」で止める
   3. 税率を返す

## domain/shared/calendar.ts

### 暦日付の判定

- 関数: `isCalendarDate`
- 引数: テキスト
- 処理:

   1. 一致済みを`/^(\d{4})-(\d{2})-(\d{2})$/.exec(text)`で求める
   2. 一致済みが空である場合
      1. `false`を返す
   3. 年を`Number(matched[1])`で求める
   4. 月を`Number(matched[2])`で求める
   5. 日を`Number(matched[3])`で求める
   6. 日付を`new Date(Date.UTC(year, month - 1, day))`で求める
   7. `date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day`を返す

### 日付の分割

- 関数: `splitDate`
- 引数: テキスト
- 処理:

   1. `[year = 0, month = 0, day = 0]`を`text.split('-').map(Number)`で求める
   2. 年・月・日を返す

### 日付の組み立て

- 関数: `composeDate`
- 引数: 部分
- 処理:

   1. ``${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}``を返す

### 月の長さの測定

- 関数: `measureMonthLength`
- 引数: 年、月
- 処理:

   1. `new Date(Date.UTC(year, month, 0)).getUTCDate()`を返す

### 月のずらし

- 関数: `shiftMonth`
- 引数: 年、月、月数
- 処理:

   1. 位置を`year * 12 + (month - 1) + offset`にする
   2. `{ year: Math.floor(index / 12), month: (index % 12) + 1 }`を返す

### 月日の当てはめ

- 関数: `placeMonthDay`
- 引数: 年、月、月日
- 処理:

   1. 日付を組み立てる（その結果を返す）

### より前の日付の判定

- 関数: `isEarlierDate`
- 引数: 左、右
- 処理:

   1. `left < right`を返す

## domain/shared/dateValue.ts

### 日付テキストの解釈

- 関数: `interpretDateText`
- 引数: テキスト
- 処理:

   1. テキストを前後の空白を除く
   2. 前後の空白を除いたテキストが空である場合
      1. エラー「{field}を記入してください。」で止める
   3. 暦日付でない場合
      1. エラー「{field}は実在する日付を YYYY-MM-DD の形で記入してください。」で止める
   4. 前後の空白を除いたテキストを返す

## domain/shared/validation.ts

### 値の拒否

- 関数: `rejectValue`
- 引数: メッセージキー、パラメーター
- 処理:

   1. `new ValidationError([{ field: '', messageKey, params }])`を返す

### 項目の拒否

- 関数: `rejectField`
- 引数: 項目、メッセージキー、パラメーター
- 処理:

   1. `new ValidationError([{ field, messageKey, params }])`を返す

### 項目の解釈

- 関数: `interpretFields`
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
- 引数: 金額
- 処理:

   1. `amounts.reduce((total, amount) => total + amount, 0)`を返す
