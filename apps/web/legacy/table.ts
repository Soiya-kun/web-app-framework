// 旧システムのテーブル。列の意味と、新しいテーブルへ移す先を書く（移す先は検査でマイグレーションと照らし合わせる）。
import { defineLegacyTable } from '@app/flow'

export const legacySales = defineLegacyTable('T_URIAGE', {
  title: '売上伝票',
  note: '経理担当が、営業担当の売上伝票を見て1行ずつ記入する。税率の列はなく、請求書を印刷するときに 10% で計算する。',
  columns: [
    { name: 'DENPYO_NO', title: '伝票番号', type: 'CHAR(8)', replacement: 'sales.sales_id' },
    { name: 'TOKUI_CD', title: '得意先コード', type: 'CHAR(6)', replacement: 'sales.customer_id' },
    { name: 'URIAGE_YMD', title: '売上日', type: 'CHAR(8)', note: 'YYYYMMDD の文字', replacement: 'sales.sales_date' },
    { name: 'HINMEI', title: '品名', type: 'VARCHAR(40)', replacement: 'sales.item_name' },
    { name: 'KINGAKU', title: '金額（税抜）', type: 'NUMBER(10)', replacement: 'sales.sales_amount' },
    { name: 'SEIKYU_FLG', title: '請求済みの印', type: 'CHAR(1)', note: '請求書を印刷すると 1 にする。新しいシステムでは、どの請求に載せたか（invoice_id）で持つ' },
  ],
})

export const legacyInvoice = defineLegacyTable('T_SEIKYU', {
  title: '請求',
  note: '得意先ごと・締め日ごとに1行。請求書を印刷したときに作り、作り直せない。',
  columns: [
    { name: 'SEIKYU_NO', title: '請求番号', type: 'CHAR(10)', replacement: 'invoice.invoice_number' },
    { name: 'TOKUI_CD', title: '得意先コード', type: 'CHAR(6)', replacement: 'invoice.billing_customer_id' },
    { name: 'SIME_YMD', title: '締め日', type: 'CHAR(8)', replacement: 'invoice.closing_date' },
    { name: 'ZENKAI_ZAN', title: '前回請求額', type: 'NUMBER(12)', replacement: 'invoice.previous_amount' },
    { name: 'NYUKIN_GAKU', title: '今回入金額', type: 'NUMBER(12)', replacement: 'invoice.payment_amount' },
    { name: 'URIAGE_GAKU', title: '今回売上額', type: 'NUMBER(12)', replacement: 'invoice.sales_amount' },
    { name: 'SHOHIZEI', title: '消費税額', type: 'NUMBER(10)', replacement: 'invoice.tax_amount' },
    { name: 'SEIKYU_GAKU', title: '今回請求額', type: 'NUMBER(12)', replacement: 'invoice.invoice_amount' },
  ],
})

export const legacyPayment = defineLegacyTable('T_NYUKIN', {
  title: '入金',
  note: '経理担当が、通帳を見て記入する。振込人の名前から得意先を探すのは、経理担当の記憶に頼っている。',
  columns: [
    { name: 'NYUKIN_NO', title: '入金番号', type: 'CHAR(8)', replacement: 'payment.payment_id' },
    { name: 'NYUKIN_YMD', title: '入金日', type: 'CHAR(8)', replacement: 'payment.payment_date' },
    { name: 'TOKUI_CD', title: '得意先コード', type: 'CHAR(6)', replacement: 'payment.customer_id' },
    { name: 'KINGAKU', title: '入金額', type: 'NUMBER(12)', replacement: 'payment.payment_amount' },
    { name: 'FURIKOMI_NM', title: '振込人', type: 'VARCHAR(40)', replacement: 'payment.payer_name' },
    { name: 'TESURYO', title: '振込手数料', type: 'NUMBER(6)', note: '新しいシステムでは、調整（振込手数料）として持つ', replacement: 'adjustment.adjustment_amount' },
  ],
})
