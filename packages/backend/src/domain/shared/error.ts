import type { MessageKey, MessageParams } from '@app/vocabulary'

/** 業務エラーの種類。handler の共通処理が HTTP の状態コードに変換する。 */
export type ErrorKind = 'validation' | 'forbidden' | 'notFound' | 'conflict'

/** 項目ごとの入力の問題。field は API の項目名。 */
export type FieldProblem = {
  readonly field: string
  readonly messageKey: MessageKey
  readonly params: MessageParams
}

/** 業務上の理由で処理を止めるエラー。画面に出す文はメッセージ帳のキーで持つ。 */
export class AppError extends Error {
  readonly kind: ErrorKind
  readonly messageKey: MessageKey
  readonly params: MessageParams

  constructor(kind: ErrorKind, messageKey: MessageKey, params: MessageParams = {}) {
    super(messageKey)
    this.name = new.target.name
    this.kind = kind
    this.messageKey = messageKey
    this.params = params
  }
}

export class ValidationError extends AppError {
  readonly problems: readonly FieldProblem[]

  constructor(problems: readonly FieldProblem[]) {
    super('validation', 'invalidInput')
    this.problems = problems
  }
}

export class ForbiddenError extends AppError {
  constructor(messageKey: MessageKey, params: MessageParams = {}) {
    super('forbidden', messageKey, params)
  }
}

export class NotFoundError extends AppError {
  constructor(messageKey: MessageKey, params: MessageParams = {}) {
    super('notFound', messageKey, params)
  }
}

export class ConflictError extends AppError {
  constructor(messageKey: MessageKey, params: MessageParams = {}) {
    super('conflict', messageKey, params)
  }
}
