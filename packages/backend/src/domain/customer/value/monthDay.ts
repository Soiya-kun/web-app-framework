import type { Brand } from '../../shared/brand'

/** 月の中の日（1〜31）。31 は月末を表す。締日・回収日に使う。 */
export type MonthDay = Brand<number, 'MonthDay'>
