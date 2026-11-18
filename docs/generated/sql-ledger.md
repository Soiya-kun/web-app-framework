# SQL の台帳

> 生成物。`pnpm sql:ledger` で packages/backend/src/repository/postgres の defineStatement から作る。手で編集しない。
> repository が実行する SQL は、ここにあるものだけ（Executor は defineStatement で定義した SQL しか受け付けない）。

SQL の数: 6

## findCustomer

[packages/backend/src/repository/postgres/customerStatement.ts:5](../../packages/backend/src/repository/postgres/customerStatement.ts#L5)

```sql
SELECT customer_id AS "customerId",
       customer_name AS "customerName",
       billing_customer_id AS "billingCustomerId",
       closing_day AS "closingDay",
       collection_month_offset AS "collectionMonthOffset",
       collection_day AS "collectionDay"
FROM customer
WHERE customer_id = $1
```

## listCustomers

[packages/backend/src/repository/postgres/customerStatement.ts:19](../../packages/backend/src/repository/postgres/customerStatement.ts#L19)

```sql
SELECT customer_id AS "customerId",
       customer_name AS "customerName",
       billing_customer_id AS "billingCustomerId",
       closing_day AS "closingDay",
       collection_month_offset AS "collectionMonthOffset",
       collection_day AS "collectionDay"
FROM customer
ORDER BY customer_id
```

## beginTransaction

[packages/backend/src/repository/postgres/postgresDatabase.ts:7](../../packages/backend/src/repository/postgres/postgresDatabase.ts#L7)

```sql
BEGIN
```

## commitTransaction

[packages/backend/src/repository/postgres/postgresDatabase.ts:8](../../packages/backend/src/repository/postgres/postgresDatabase.ts#L8)

```sql
COMMIT
```

## rollbackTransaction

[packages/backend/src/repository/postgres/postgresDatabase.ts:9](../../packages/backend/src/repository/postgres/postgresDatabase.ts#L9)

```sql
ROLLBACK
```

## createSales

[packages/backend/src/repository/postgres/salesStatement.ts:3](../../packages/backend/src/repository/postgres/salesStatement.ts#L3)

```sql
INSERT INTO sales (sales_id, customer_id, sales_date, sales_kind, item_name, sales_amount, tax_rate)
VALUES ($1, $2, $3, $4, $5, $6, $7)
```
