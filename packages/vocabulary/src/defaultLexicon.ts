// 生成した概念から作った、既定の索引。lint・翻訳ツール・SQL の台帳の検査が使う。
import { conceptList } from './generated/conceptData'
import { prepareLexicon } from './lexicon'

export const defaultLexicon = prepareLexicon(conceptList).lexicon
