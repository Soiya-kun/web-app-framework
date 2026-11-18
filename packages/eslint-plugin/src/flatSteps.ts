// usecase は「関数を呼び、戻り値を次の関数の引数へ渡す」だけにする。
// 判定・計算・繰り返し・エラーの送出は domain の関数へ出す。repository などの部品のメソッドは1段だけ呼べる。
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'
import { createRule } from './createRule'

type MessageId = 'statementNotAllowed' | 'methodChain' | 'calleeNotAllowed' | 'argumentNotAllowed' | 'callRequired' | 'returnNotAllowed' | 'declarationNotAllowed'

const statementLabel: Partial<Record<string, string>> = {
  IfStatement: 'if',
  SwitchStatement: 'switch',
  ForStatement: 'for',
  ForOfStatement: 'for...of',
  ForInStatement: 'for...in',
  WhileStatement: 'while',
  DoWhileStatement: 'do...while',
  TryStatement: 'try/catch',
  ThrowStatement: 'throw',
}

export const flatSteps = createRule<[], MessageId>({
  name: 'flat-steps',
  meta: {
    type: 'problem',
    docs: { description: 'usecase を関数呼び出しの並びだけにする' },
    messages: {
      statementNotAllowed: 'usecase に {{statement}} は書けません。判定・繰り返し・エラーは domain の関数へ出します。',
      methodChain: 'usecase ではメソッドチェーンを使えません。',
      calleeNotAllowed: 'usecase で呼べるのは、関数か部品（repository など）のメソッド1段だけです。',
      argumentNotAllowed: 'usecase の引数には変数だけを渡せます（値の組み立て・リテラル・計算は domain の関数へ出します）。',
      callRequired: 'usecase の手順は、関数呼び出し（await 可）にします。',
      returnNotAllowed: 'usecase は変数だけを返せます。',
      declarationNotAllowed: 'usecase の変数は const で1つずつ宣言し、名前か分割代入で受けます。',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function checkCall(expression: TSESTree.Expression): void {
      const call = expression.type === AST_NODE_TYPES.AwaitExpression ? expression.argument : expression
      if (call.type !== AST_NODE_TYPES.CallExpression) {
        context.report({ node: expression, messageId: 'callRequired' })
        return
      }
      const callee = call.callee
      if (callee.type === AST_NODE_TYPES.MemberExpression) {
        if (callee.object.type === AST_NODE_TYPES.CallExpression || callee.object.type === AST_NODE_TYPES.MemberExpression) {
          context.report({ node: callee, messageId: 'methodChain' })
        } else if (callee.object.type !== AST_NODE_TYPES.Identifier || callee.computed || callee.optional) {
          context.report({ node: callee, messageId: 'calleeNotAllowed' })
        }
      } else if (callee.type !== AST_NODE_TYPES.Identifier) {
        context.report({ node: callee, messageId: 'calleeNotAllowed' })
      }
      for (const argument of call.arguments) {
        if (argument.type !== AST_NODE_TYPES.Identifier) {
          context.report({ node: argument, messageId: 'argumentNotAllowed' })
        }
      }
    }

    function isNamePattern(pattern: TSESTree.Node): boolean {
      if (pattern.type === AST_NODE_TYPES.Identifier) {
        return true
      }
      return (
        pattern.type === AST_NODE_TYPES.ObjectPattern &&
        pattern.properties.every(
          (property) =>
            property.type === AST_NODE_TYPES.Property && property.shorthand && property.value.type === AST_NODE_TYPES.Identifier,
        )
      )
    }

    function checkStatement(statement: TSESTree.Statement): void {
      switch (statement.type) {
        case AST_NODE_TYPES.VariableDeclaration: {
          const [declarator] = statement.declarations
          if (statement.kind !== 'const' || statement.declarations.length !== 1 || declarator === undefined || !isNamePattern(declarator.id)) {
            context.report({ node: statement, messageId: 'declarationNotAllowed' })
            return
          }
          if (declarator.init === null) {
            context.report({ node: declarator, messageId: 'callRequired' })
            return
          }
          checkCall(declarator.init)
          return
        }
        case AST_NODE_TYPES.ExpressionStatement:
          checkCall(statement.expression)
          return
        case AST_NODE_TYPES.ReturnStatement:
          if (statement.argument !== null && statement.argument.type !== AST_NODE_TYPES.Identifier) {
            context.report({ node: statement.argument, messageId: 'returnNotAllowed' })
          }
          return
        default:
          context.report({
            node: statement,
            messageId: 'statementNotAllowed',
            data: { statement: statementLabel[statement.type] ?? statement.type },
          })
      }
    }

    function checkBody(node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression): void {
      if (node.body === null || node.body === undefined) {
        return
      }
      if (node.body.type !== AST_NODE_TYPES.BlockStatement) {
        checkCall(node.body)
        return
      }
      node.body.body.forEach(checkStatement)
    }

    return {
      'Program > FunctionDeclaration': checkBody,
      'Program > ExportNamedDeclaration > FunctionDeclaration': checkBody,
    }
  },
})
