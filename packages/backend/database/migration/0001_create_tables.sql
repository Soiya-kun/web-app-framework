-- 売上から入金管理までのテーブル。ログ・作成日時・更新者などの列は持たない。
-- 金額はすべて円の整数。日付は YYYY-MM-DD（date 型）。

-- 顧客（得意先）。請求先は自分自身か、ほかの顧客（親会社など）。
-- 締日・回収条件は、請求先として使うときだけ意味を持つ。
CREATE TABLE customer (
  customer_id text PRIMARY KEY,
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 100),
  billing_customer_id text NOT NULL REFERENCES customer (customer_id),
  closing_day smallint NOT NULL CHECK (closing_day BETWEEN 1 AND 31),                    -- 31 は月末
  collection_month_offset smallint NOT NULL CHECK (collection_month_offset BETWEEN 0 AND 3), -- 0 当月・1 翌月・2 翌々月
  collection_day smallint NOT NULL CHECK (collection_day BETWEEN 1 AND 31)                -- 31 は月末
);

-- 振込依頼人の名前と請求先の対応。名前の違う振込を、次からは顧客を特定して登録できるようにする。
CREATE TABLE payer_name (
  payer_name text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customer (customer_id)
);

-- 売上。返品・値引は負の金額で持つ。金額は税抜で、消費税は請求でまとめて計算する。
CREATE TABLE sales (
  sales_id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customer (customer_id),
  sales_date date NOT NULL,
  sales_kind text NOT NULL CHECK (sales_kind IN ('normal', 'return', 'discount')),
  item_name text NOT NULL CHECK (char_length(item_name) BETWEEN 1 AND 100),
  sales_amount bigint NOT NULL,
  tax_rate smallint NOT NULL CHECK (tax_rate IN (8, 10)),
  CHECK ((sales_kind = 'normal' AND sales_amount > 0) OR (sales_kind <> 'normal' AND sales_amount < 0))
);
CREATE INDEX sales_customer_date ON sales (customer_id, sales_date);

-- 請求。請求先ごと・締め日ごとに売上をまとめる。
-- 発行前（invoice_number・issue_date が NULL）は締め直せる。発行後は変えず、訂正は次の請求の返品・値引で行う。
CREATE TABLE invoice (
  invoice_id text PRIMARY KEY,
  billing_customer_id text NOT NULL REFERENCES customer (customer_id),
  closing_date date NOT NULL,
  due_date date NOT NULL,
  invoice_amount bigint NOT NULL CHECK (invoice_amount > 0), -- 税込の請求額
  invoice_number text UNIQUE,
  issue_date date,
  UNIQUE (billing_customer_id, closing_date),
  CHECK ((invoice_number IS NULL) = (issue_date IS NULL)),
  CHECK (due_date >= closing_date)
);

-- 請求に入れた売上。1つの売上は1つの請求にだけ入る。
CREATE TABLE invoice_sales (
  sales_id text PRIMARY KEY REFERENCES sales (sales_id),
  invoice_id text NOT NULL REFERENCES invoice (invoice_id) ON DELETE CASCADE
);
CREATE INDEX invoice_sales_invoice ON invoice_sales (invoice_id);

-- 請求の税率ごとの合計と消費税額（インボイス制度。1円未満は請求ごと・税率ごとに切り捨て）。
CREATE TABLE invoice_tax (
  invoice_id text NOT NULL REFERENCES invoice (invoice_id) ON DELETE CASCADE,
  tax_rate smallint NOT NULL CHECK (tax_rate IN (8, 10)),
  taxable_amount bigint NOT NULL,
  tax_amount bigint NOT NULL,
  PRIMARY KEY (invoice_id, tax_rate)
);

-- 請求番号の採番。発行した年ごとに、欠番なく1から振る。
CREATE TABLE invoice_counter (
  issue_year smallint PRIMARY KEY,
  last_number integer NOT NULL CHECK (last_number >= 0)
);

-- 入金。customer_id が NULL の入金は、振込人を特定できていない入金（仮受）。
CREATE TABLE payment (
  payment_id text PRIMARY KEY,
  payment_date date NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('transfer', 'cash', 'other')),
  payment_amount bigint NOT NULL CHECK (payment_amount > 0),
  payer_name text NOT NULL CHECK (char_length(payer_name) BETWEEN 1 AND 100),
  customer_id text REFERENCES customer (customer_id)
);
CREATE INDEX payment_customer ON payment (customer_id);

-- 消込。1回の消込で、同じ請求先の入金（1件以上）を請求（1件以上）へ充てる。取り消すときは消込ごと消す。
CREATE TABLE reconciliation (
  reconciliation_id text PRIMARY KEY,
  billing_customer_id text NOT NULL REFERENCES customer (customer_id),
  reconciliation_date date NOT NULL
);

-- 充当。どの入金のいくらを、どの請求へ充てたか（入金と請求の多対多）。
CREATE TABLE allocation (
  reconciliation_id text NOT NULL REFERENCES reconciliation (reconciliation_id) ON DELETE CASCADE,
  payment_id text NOT NULL REFERENCES payment (payment_id),
  invoice_id text NOT NULL REFERENCES invoice (invoice_id),
  allocation_amount bigint NOT NULL CHECK (allocation_amount > 0),
  PRIMARY KEY (reconciliation_id, payment_id, invoice_id)
);
CREATE INDEX allocation_payment ON allocation (payment_id);
CREATE INDEX allocation_invoice ON allocation (invoice_id);

-- 差額の調整。入金が請求に足りない分を、当社の負担として請求から差し引く（振込手数料・端数）。
CREATE TABLE adjustment (
  reconciliation_id text NOT NULL REFERENCES reconciliation (reconciliation_id) ON DELETE CASCADE,
  invoice_id text NOT NULL REFERENCES invoice (invoice_id),
  adjustment_kind text NOT NULL CHECK (adjustment_kind IN ('transferFee', 'smallDifference')),
  adjustment_amount bigint NOT NULL CHECK (adjustment_amount > 0),
  PRIMARY KEY (reconciliation_id, invoice_id, adjustment_kind)
);
CREATE INDEX adjustment_invoice ON adjustment (invoice_id);

-- 返金。請求に充てない入金（過入金・二重入金・他社宛の誤入金）を振込人へ返す。
CREATE TABLE refund (
  refund_id text PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payment (payment_id),
  refund_date date NOT NULL,
  refund_amount bigint NOT NULL CHECK (refund_amount > 0)
);
CREATE INDEX refund_payment ON refund (payment_id);
