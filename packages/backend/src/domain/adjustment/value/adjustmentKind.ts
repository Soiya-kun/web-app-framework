/**
 * 調整の区分。transferFee（振込手数料）と smallDifference（端数差額）は、入金の不足を当社の負担とするもの（正）。
 * correction（訂正）は、発行した請求に載せた入金などの誤りを次の請求で直すもの（正負どちらも）。
 */
export type AdjustmentKind = 'transferFee' | 'smallDifference' | 'correction'
