import type { MessageKey, MessageParams } from '@app/vocabulary'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AppError, ValidationError, type ErrorKind, type FieldIssue } from '../domain/shared/error'

/** エラーのときの応答の形。画面はこれを読んで文を出す。 */
export type ErrorResponse = {
  readonly error: {
    readonly kind: ErrorKind | 'unexpected'
    readonly messageKey: MessageKey
    readonly params: MessageParams
    readonly issues: readonly FieldIssue[]
  }
}

const statusOfKind = {
  validation: 400,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
} as const satisfies Record<ErrorKind, ContentfulStatusCode>

/** 例外を HTTP の応答にする。バックエンドで例外を受けるのはここだけ。 */
export function respondError(error: Error, context: Context): Response {
  if (error instanceof HTTPException) {
    return error.getResponse()
  }
  if (error instanceof AppError) {
    const issues = error instanceof ValidationError ? error.issues : []
    const body: ErrorResponse = {
      error: { kind: error.kind, messageKey: error.messageKey, params: error.params, issues },
    }
    return context.json(body, statusOfKind[error.kind])
  }
  console.error(error)
  const body: ErrorResponse = {
    error: { kind: 'unexpected', messageKey: 'unexpectedError', params: {}, issues: [] },
  }
  return context.json(body, 500)
}
