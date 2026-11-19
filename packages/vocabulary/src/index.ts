// 道具（lint・翻訳ツール・バックエンドの型）向けの口。画面は '@app/vocabulary/text' を使う。
export type { ActionKey, LabelKey, MessageKey } from './generated/catalogKey'
export type { Category, Concept, Locale, WordKind } from './types'
export type { MessageParams } from './text'
export { conceptList } from './generated/conceptData'
export { splitWords } from './split'
export {
  findAvoidedTokens,
  findUnknownTokens,
  listMessages,
  readMessage,
  renderNounPhrase,
  startsWithVerb,
  translateFunctionName,
  translateStep,
} from './naming'
