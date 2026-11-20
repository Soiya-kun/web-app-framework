// API と画面のパスにも、単語帳の単語だけを使わせる（/api/invoices/:invoiceId/issue → invoices・invoiceId・issue）。
// 対象は、Hono の道筋（get・post・put・patch・delete・route・basePath の1つめの引数）と、画面の道筋（path: '…'）の、/ で始まる文字列。
import { findUnknownTokens } from '@app/vocabulary'
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'
import { createRule } from './createRule'

const routeMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'route', 'basePath'])

/** パスを、単語帳で読む名前の並びにする。:invoiceId・$invoiceId は引数の名前を読む。 */
export function splitPath(path: string): string[] {
  return path
    .split('/')
    .map((segment) => segment.replace(/^[:$]/, ''))
    .filter((segment) => segment !== '' && segment !== '*')
}

export const knownPath = createRule({
  name: 'known-path',
  meta: {
    type: 'problem',
    docs: { description: 'API と画面のパスに単語帳の単語だけを使う' },
    messages: {
      unknownWord: 'パス「{{path}}」に、単語帳にない単語「{{word}}」があります。packages/vocabulary/words に登録するか、単語帳の言葉にします。',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function checkPath(node: TSESTree.Node): void {
      if (node.type !== AST_NODE_TYPES.Literal || typeof node.value !== 'string' || !node.value.startsWith('/')) {
        return
      }
      const path = node.value
      for (const segment of splitPath(path)) {
        for (const word of findUnknownTokens(segment)) {
          context.report({ node, messageId: 'unknownWord', data: { word, path } })
        }
      }
    }

    return {
      CallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.MemberExpression && node.callee.property.type === AST_NODE_TYPES.Identifier && routeMethods.has(node.callee.property.name)) {
          const [first] = node.arguments
          if (first !== undefined) {
            checkPath(first)
          }
        }
      },
      Property(node) {
        if (!node.computed && node.key.type === AST_NODE_TYPES.Identifier && node.key.name === 'path') {
          checkPath(node.value)
        }
      },
    }
  },
})
