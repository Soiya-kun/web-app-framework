# 処理の日本語訳

> 生成物。`pnpm translate` で packages/backend/src の usecase・domain から作る。手で編集しない。

## usecase/customer/listCustomers.ts

### 顧客の一覧取得

- 関数: `listCustomers`
- 目的: 売上の登録で選べる顧客を示すため。
- 引数: 顧客リポジトリ
- 処理:

   1. 顧客を一覧取得する
   2. 顧客を返す

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

   1. 前後の空白を除いたテキストを`text.trim()`で求める
   2. 前後の空白を除いたテキストが空である場合
      1. エラー「{field}を入力してください。」で止める
   3. 暦日付でない場合
      1. エラー「{field}は実在する日付を YYYY-MM-DD の形で入力してください。」で止める
   4. 前後の空白を除いたテキストを返す

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

## domain/shared/validation.ts

### 値の拒否

- 関数: `rejectValue`
- 目的: 1つの値を受け付けないことを表すため。項目名は interpretFields が付ける。
- 引数: メッセージキー、値
- 処理:

   1. `new ValidationError([{ field: '', messageKey, params }])`を返す

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
