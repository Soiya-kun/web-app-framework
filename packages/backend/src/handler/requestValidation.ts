import { ValidationError } from '../domain/shared/error'

/** 画面が送る形（項目と型）と違うリクエストを、入力の問題として止める。値の中身は domain が検証する。 */
export function rejectInvalidRequest(result: { success: boolean }): void {
  if (!result.success) {
    throw new ValidationError([{ field: '', messageKey: 'invalidRequest', params: {} }])
  }
}
