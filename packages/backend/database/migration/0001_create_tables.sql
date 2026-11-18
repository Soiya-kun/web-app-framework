-- 売上から入金管理までのテーブル。ログ・作成日時・更新者などの列は持たない。
-- 金額はすべて円の整数。日付は YYYY-MM-DD（date 型）。
-- 請求書は残高を繰り越す形（前回請求額・今回入金額・調整額・繰越額・今回売上額・消費税額・今回請求額）。
-- 売上・入金・返金・調整は、締めたときに invoice_id へ「どの請求に載せたか」を入れる。NULL はまだ請求に載せていない。

-- 顧客（得意先）。請求先は自分自身か、ほかの顧客（親会社など）。
-- 締日・回収条件は、請求先として使うときだけ意味を持つ。
CREATE TABLE customer (
  customer_id text PRIMARY KEY,
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 100),
  billing_customer_id text NOT NULL REFERENCES customer (customer_id),
  closing_day smallint NOT NULL CHECK (closing_day BETWEEN 1 AND 31),                         -- 31 は月末
  collection_month_offset smallint NOT NULL CHECK (collection_month_offset BETWEEN 0 AND 3), -- 0 当月・1 翌月・2 翌々月
  collection_day smallint NOT NULL CHECK (collection_day BETWEEN 1 AND 31)                    -- 31 は月末
);

-- 振込依頼人の名前と請求先の対応。名前の違う振込を、次からは顧客を特定して登録できるようにする。
CREATE TABLE payer_name (
  payer_name text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customer (customer_id)
);

-- 請求。請求先ごと・締め日ごとに1件。前回の請求から残高を繰り越す。
-- 発行前（invoice_number・issue_date が NULL）は締めを取り消せる。発行後は変えず、訂正は次の請求で行う。
CREATE TABLE invoice (
  invoice_id text PRIMARY KEY,
  billing_customer_id text NOT NULL REFERENCES customer (customer_id),
  previous_invoice_id text UNIQUE REFERENCES invoice (invoice_id), -- 前回の請求。初回は NULL
  closing_date date NOT NULL,
  due_date date NOT NULL,
  previous_amount bigint NOT NULL,   -- 前回請求額（前回の請求の今回請求額。初回は 0）
  payment_amount bigint NOT NULL,    -- 今回入金額（入金 − 返金）
  adjustment_amount bigint NOT NULL, -- 調整額（振込手数料・端数・訂正）
  carried_amount bigint NOT NULL,    -- 繰越額（負は前受）
  sales_amount bigint NOT NULL,      -- 今回売上額（税抜。返品・値引を含む）
  tax_amount bigint NOT NULL,        -- 消費税額
  invoice_amount bigint NOT NULL,    -- 今回請求額（負は前受）
  invoice_number text UNIQUE,
  issue_date date,
  UNIQUE (billing_customer_id, closing_date),
  CHECK (carried_amount = previous_amount - payment_amount - adjustment_amount),
  CHECK (invoice_amount = carried_amount + sales_amount + tax_amount),
  CHECK ((invoice_number IS NULL) = (issue_date IS NULL)),
  CHECK (due_date >= closing_date)
);

-- 請求の税率ごとの合計と消費税額（インボイス制度。1円未満は請求ごと・税率ごとに 0 の方へ切り捨て）。
CREATE TABLE invoice_tax (
  invoice_id text NOT NULL REFERENCES invoice (invoice_id),
  tax_rate smallint NOT NULL CHECK (tax_rate IN (8, 10)),
  taxable_amount bigint NOT NULL,
  tax_amount bigint NOT NULL,
  PRIMARY KEY (invoice_id, tax_rate)
);

-- 請求番号の採番。発行した年ごとに、欠番なく1から振る。
CREATE TABLE invoice_counter (
  issue_year smallint PRIMARY KEY,
  last_number integer NOT NULL CHECK (last_number >= 1)
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
  invoice_id text REFERENCES invoice (invoice_id),
  CHECK ((sales_kind = 'normal' AND sales_amount > 0) OR (sales_kind <> 'normal' AND sales_amount < 0))
);
CREATE INDEX sales_unbilled ON sales (customer_id, sales_date) WHERE invoice_id IS NULL;
CREATE INDEX sales_invoice ON sales (invoice_id);

-- 入金。customer_id が NULL の入金は、振込人を特定できていない入金（仮受）で、請求には載せない。
CREATE TABLE payment (
  payment_id text PRIMARY KEY,
  payment_date date NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('transfer', 'cash', 'other')),
  payment_amount bigint NOT NULL CHECK (payment_amount > 0),
  payer_name text NOT NULL CHECK (char_length(payer_name) BETWEEN 1 AND 100),
  customer_id text REFERENCES customer (customer_id),
  invoice_id text REFERENCES invoice (invoice_id),
  CHECK (invoice_id IS NULL OR customer_id IS NOT NULL)
);
CREATE INDEX payment_unbilled ON payment (customer_id, payment_date) WHERE invoice_id IS NULL;
CREATE INDEX payment_invoice ON payment (invoice_id);

-- 返金。過入金・二重入金・他社宛の誤入金を、振込人へ返す。請求先の入金の返金は、今回入金額から差し引く。
CREATE TABLE refund (
  refund_id text PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payment (payment_id),
  refund_date date NOT NULL,
  refund_amount bigint NOT NULL CHECK (refund_amount > 0),
  invoice_id text REFERENCES invoice (invoice_id)
);
CREATE INDEX refund_payment ON refund (payment_id);
CREATE INDEX refund_invoice ON refund (invoice_id);

-- 調整。請求先の残高を、入金でなく当社の判断で減らす（正）・増やす（負）。
-- 振込手数料・端数差額は正。訂正（発行した請求に載せた入金などの誤りを直す）は正負どちらも。
CREATE TABLE adjustment (
  adjustment_id text PRIMARY KEY,
  billing_customer_id text NOT NULL REFERENCES customer (customer_id),
  adjustment_date date NOT NULL,
  adjustment_kind text NOT NULL CHECK (adjustment_kind IN ('transferFee', 'smallDifference', 'correction')),
  adjustment_amount bigint NOT NULL,
  payment_id text REFERENCES payment (payment_id), -- 差額のもとになった入金（任意）
  invoice_id text REFERENCES invoice (invoice_id),
  CHECK ((adjustment_kind = 'correction' AND adjustment_amount <> 0) OR (adjustment_kind <> 'correction' AND adjustment_amount > 0))
);
CREATE INDEX adjustment_unbilled ON adjustment (billing_customer_id, adjustment_date) WHERE invoice_id IS NULL;
CREATE INDEX adjustment_invoice ON adjustment (invoice_id);
