// システムの外の業務と外のイベント。業務フローの段は、ここに書いた値を使う。
// 現行の業務フローも、変わらない段は同じ値を使うので、現行と新しい業務フローで同じ業務だと分かる。
import { occur, outside } from '@app/flow'
import { accountant, customer, salesperson } from '../role/role'

// システムの外の業務
export const deliverProduct = outside(salesperson, 'deliverProduct')
export const sendInvoice = outside(accountant, 'sendInvoice')
export const sendReminder = outside(accountant, 'sendReminder')
export const payRefund = outside(accountant, 'payRefund')

// 外のイベント
export const payInvoice = occur(customer, 'payInvoice')
export const sendReturn = occur(customer, 'sendReturn')
