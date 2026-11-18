import type { MessageKey, MessageParams } from '@app/vocabulary'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AppError, ValidationError, type ErrorKind, type FieldProblem } from '../domain/shared/error'

/** エラーのときの応答の形。画面はこれを読んで文を出す。 */
export type ErrorResponse = {
  readonly error: {
    readonly kind: ErrorKind | 'unexpected'
    readonly messageKey: MessageKey
    readonly params: MessageParams
    readonly problems: readonly FieldProblem[]
  }
}

const statusOfKind = {
  validation: 400,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
} as const satisfies Record<ErrorKind, ContentfulStatusCode>

/** PostgreSQL の一意制約の違反（同じキーの行がすでにある）。 */
function isUniqueViolation(error: Error): boolean {
  return 'code' in error && error.code === '23505'
}

/** 例外を HTTP の応答にする。バックエンドで例外を受けるのは、こことトランザクションの境界だけ。 */
export function respondError(error: Error, context: Context): Response {
  if (error instanceof HTTPException) {
    return error.getResponse()
  }
  if (isUniqueViolation(error)) {
    const body: ErrorResponse = {
      error: { kind: 'conflict', messageKey: 'duplicateTarget', params: {}, problems: [] },
    }
    return context.json(body, 409)
  }
  if (error instanceof AppError) {
    const problems = error instanceof ValidationError ? error.problems : []
    const body: ErrorResponse = {
      error: { kind: error.kind, messageKey: error.messageKey, params: error.params, problems },
    }
    return context.json(body, statusOfKind[error.kind])
  }
  console.error(error)
  const body: ErrorResponse = {
    error: { kind: 'unexpected', messageKey: 'unexpectedError', params: {}, problems: [] },
  }
  return context.json(body, 500)
}
