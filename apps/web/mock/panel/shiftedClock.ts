// 画面の時計（Date）をずらす。業務フローの「時の経過」の段で今日を変えたら、画面が読む今日（発行日などの初期値）を、その日にする。
// 画面のモジュールより先に読まれるので、画面が読む今日（発行日などの初期値）も、ずらした日付になる。

const SystemDate = Date
let clockOffset = 0

/** 引数のない new Date() と Date.now() だけを、ずらした時刻にする。日付を渡して作る Date はそのまま。 */
class ShiftedDate extends SystemDate {
  constructor(...parts: readonly unknown[]) {
    if (parts.length === 0) {
      super(SystemDate.now() + clockOffset)
    } else {
      super(...(parts as [string]))
    }
  }

  static override now(): number {
    return SystemDate.now() + clockOffset
  }
}

globalThis.Date = ShiftedDate as DateConstructor

/** 本当の時刻とのずれ（ミリ秒）を変える。 */
export function assignClockOffset(offset: number): void {
  clockOffset = offset
}
