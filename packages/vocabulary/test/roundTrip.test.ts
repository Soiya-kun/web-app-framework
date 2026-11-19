// 往復の検査。生成した日本語の見出しを日本語の文法で読み戻し、元の名前と同じ概念の並びに戻ることを確かめる。
// 英語と日本語が単語帳のマスタで1対1につながっている（日本語から英語の名前へ1通りに戻せる）ことの保証。
import { describe, expect, test } from 'vitest'
import { readLexemes } from '../src/analyze'
import { defaultLexicon } from '../src/defaultLexicon'
import { conceptList } from '../src/generated/conceptData'
import ja from '../src/generated/locale/ja.json'
import { readJapanese } from '../src/reverse'
import { splitWords } from '../src/split'

const labels = Object.entries(ja.label as Readonly<Record<string, string>>)

/** 名前を概念の並びにする（単数・複数は同じ概念）。 */
function conceptsOfName(name: string): string[] {
  return readLexemes(defaultLexicon, splitWords(name)).map((lexeme) => (lexeme.kind === 'known' ? lexeme.surface.concept.id : `?${lexeme.text}`))
}

describe('日本語の見出しの往復', () => {
  test.each(labels)('%s →「%s」→ 元の概念の並びに1通りに戻る', (key, text) => {
    const readings = readJapanese(conceptList, text).map((reading) => reading.map((part) => part.concept.id))

    expect(readings).toEqual([conceptsOfName(key)])
  })
})
