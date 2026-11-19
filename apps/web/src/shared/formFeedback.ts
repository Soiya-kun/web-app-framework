import type { LabelKey, Text } from '@app/vocabulary/text'
import { ApiError } from './apiClient'

/**
 * フォームの送信の失敗を、項目ごとの問題の文と、項目に結びつかない失敗の文にする。
 * fieldLabels は、API の項目名から画面の見出しの名前（単語帳）への対応。
 */
export function prepareFormFeedback<Field extends string>(
  text: Text,
  error: Error | null,
  fieldLabels: Readonly<Record<Field, LabelKey>>,
) {
  const failure = error instanceof ApiError ? error.detail : undefined

  function describeProblem(field: Field): string | undefined {
    const problem = failure?.problems.find((item) => item.field === field)
    return problem === undefined
      ? undefined
      : text.message(problem.messageKey, { ...problem.params, field: text.label(fieldLabels[field]) })
  }

  function describeField(field: Field) {
    const problemText = describeProblem(field)
    return {
      id: field,
      name: field,
      'aria-invalid': problemText !== undefined,
      'aria-describedby': problemText === undefined ? undefined : `${field}-problem`,
    }
  }

  const generalFailure =
    failure !== undefined && failure.problems.length === 0 ? text.message(failure.messageKey, failure.params) : undefined

  return { describeProblem, describeField, generalFailure }
}

/** FormData から1つの項目の文字列を読む。 */
export function readField(formData: FormData, field: string): string {
  const value = formData.get(field)
  return typeof value === 'string' ? value : ''
}
