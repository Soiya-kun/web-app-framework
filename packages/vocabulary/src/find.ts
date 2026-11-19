// 日本語の用語から、英語の名前を引く（pnpm vocabulary:find 振込依頼人の顧客 → payerCustomer）。
// 生成した見出しの表に同じ文言があればそのキーを、なければ単語帳の日本語の形で読んで組み立てた名前を出す。
import { conceptList } from './generated/conceptData'
import ja from './generated/locale/ja.json'
import { composeEnglishName, readJapanese } from './reverse'

const query = process.argv.slice(2).join('')
if (query === '') {
  console.error('使い方: pnpm vocabulary:find <日本語の用語>')
  process.exit(1)
}
const labels = ja.label as Readonly<Record<string, string>>
const exact = Object.entries(labels).flatMap(([key, text]) => (text === query ? [key] : []))
const candidates = exact.length > 0 ? exact : [...new Set(readJapanese(conceptList, query).map(composeEnglishName))]
if (candidates.length === 0) {
  console.log(`「${query}」は単語帳の言葉で組み立てられません。単語を足すか、言い方を単語帳に合わせてください。`)
} else {
  console.log(`「${query}」→ ${candidates.join(' / ')}`)
}
