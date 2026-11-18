// 関数名は動詞で始める。翻訳ツールが「動詞 → 目的語」を日本語の「目的語の動詞」に並べ替えるための文法。
// PascalCase（React のコンポーネント・クラス・型）は名詞として扱うので対象外。
import { startsWithVerb } from '@app/vocabulary'
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'
import { createRule } from './createRule'

function isPascalCase(name: string): boolean {
  return /^[A-Z]/.test(name)
}

export const verbFirst = createRule({
  name: 'verb-first',
  meta: {
    type: 'problem',
    docs: { description: '関数名を動詞で始める' },
    messages: {
      verbRequired: '関数名「{{name}}」は動詞で始めます（単語帳の pos: verb の単語）。',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function checkName(node: TSESTree.Node, name: string): void {
      if (!isPascalCase(name) && !startsWithVerb(name)) {
        context.report({ node, messageId: 'verbRequired', data: { name } })
      }
    }

    function isFunction(node: TSESTree.Node | null | undefined): boolean {
      return (
        node?.type === AST_NODE_TYPES.ArrowFunctionExpression || node?.type === AST_NODE_TYPES.FunctionExpression
      )
    }

    return {
      FunctionDeclaration(node) {
        if (node.id) {
          checkName(node.id, node.id.name)
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === AST_NODE_TYPES.Identifier && isFunction(node.init)) {
          checkName(node.id, node.id.name)
        }
      },
      MethodDefinition(node) {
        if (node.kind === 'method' && !node.computed && node.key.type === AST_NODE_TYPES.Identifier) {
          checkName(node.key, node.key.name)
        }
      },
      TSMethodSignature(node) {
        if (!node.computed && node.key.type === AST_NODE_TYPES.Identifier) {
          checkName(node.key, node.key.name)
        }
      },
    }
  },
})
