// このシステムに関わる役割。業務フローの担当・議事録の出席者・課題の担当は、ここで書いた役割の値で指す。
import { defineRole } from '@app/flow'

// 開発チーム（システムを作る側）
export const projectManager = defineRole('projectManager', { side: 'vendor' })
export const engineer = defineRole('engineer', { side: 'vendor' })

// 業務部門（システムを使う側）
export const salesperson = defineRole('salesperson', { side: 'business' })
export const accountant = defineRole('accountant', { side: 'business' })
export const approver = defineRole('approver', { side: 'business' })

// 外（業務の相手。業務フローには出るが、打合せには出ない）
export const customer = defineRole('customer', { side: 'external' })
