// ファイル名にも、単語帳の単語だけを使わせる（invoiceDetailPage.tsx → invoice・detail・page）。
// 点で区切った部分ごとに読む（postgresRepository.database.test.ts → postgresRepository・database・test）。
// 道具が決める名前（Vite の入口 main、テストの setup・test・e2e など）は対象外にする。
import { findUnknownTokens } from '@app/vocabulary'
import { createRule } from './createRule'

/** 道具の決まりで付ける名前の部分。単語帳の言葉ではないので読まない。 */
const toolNames = new Set(['main', 'index', 'setup', 'test', 'e2e', 'testing', 'd'])

/** ファイル名を、拡張子を除いて点で区切った部分にする。 */
export function splitFileName(filePath: string): string[] {
  const fileName = filePath.split(/[\\/]/).at(-1) ?? ''
  return fileName.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '').split('.')
}

export const knownFileName = createRule({
  name: 'known-file-name',
  meta: {
    type: 'problem',
    docs: { description: 'ファイル名に単語帳の単語だけを使う' },
    messages: {
      unknownWord: 'ファイル名に、単語帳にない単語「{{word}}」があります（{{part}}）。packages/vocabulary/words に登録するか、単語帳の言葉で名付けます。',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      Program(node) {
        for (const part of splitFileName(context.filename)) {
          // 道具の決まりの名前は、部分ごと（setup）でも、名前の中の単語（browserSetup の setup）でも読まない。
          if (toolNames.has(part)) {
            continue
          }
          for (const word of findUnknownTokens(part).filter((token) => !toolNames.has(token))) {
            context.report({ node, messageId: 'unknownWord', data: { word, part } })
          }
        }
      },
    }
  },
})
