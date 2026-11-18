import type { MessageKey, MessageParams } from '@app/vocabulary'
import { ValidationError, type FieldProblem } from './error'

/** 1つの値を受け付けないことを表すため。項目名は interpretFields が付ける。 */
export function rejectValue(messageKey: MessageKey, params: MessageParams = {}): ValidationError {
  return new ValidationError([{ field: '', messageKey, params }])
}

type Interpreters<Result> = { readonly [Field in keyof Result]: () => Result[Field] }

/** 項目ごとの解釈をすべて行い、受け付けない項目をまとめて画面へ返すため。 */
export function interpretFields<Result extends object>(interpreters: Interpreters<Result>): Result {
  const result: Partial<Result> = {}
  const problems: FieldProblem[] = []
  for (const field of Object.keys(interpreters) as (keyof Result & string)[]) {
    try {
      result[field] = interpreters[field]()
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error
      }
      problems.push(...error.problems.map((problem) => ({ ...problem, field: problem.field === '' ? field : `${field}.${problem.field}` })))
    }
  }
  if (problems.length > 0) {
    throw new ValidationError(problems)
  }
  return result as Result
}
