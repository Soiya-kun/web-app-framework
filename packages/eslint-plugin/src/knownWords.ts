// 自分で宣言した名前に、単語帳にない英単語を使わせない。
// ライブラリの名前を参照するだけの箇所（import した名前、オブジェクトのキー、JSX の属性など）は対象外。
import { findAvoidedTokens, findUnknownTokens } from '@app/vocabulary'
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'
import { createRule } from './createRule'
import { collectPatternNames } from './patternNames'


export const knownWords = createRule({
  name: 'known-words',
  meta: {
    type: 'problem',
    docs: { description: '名前に単語帳の単語だけを使う' },
    messages: {
      unknownWord: '単語帳にない単語「{{word}}」があります（{{name}}）。packages/vocabulary/words に登録してください。',
      avoidedWord: '「{{word}}」は使わず「{{preferred}}」を使います（{{name}}）。',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const reported = new Set<TSESTree.Node>()

    /** declare module 'ライブラリ' の中は、ライブラリの型を広げる宣言で、名前はライブラリが決める。 */
    function isInsideModuleAugmentation(node: TSESTree.Node): boolean {
      return context.sourceCode
        .getAncestors(node)
        .some((ancestor) => ancestor.type === AST_NODE_TYPES.TSModuleDeclaration && ancestor.id.type === AST_NODE_TYPES.Literal)
    }

    function checkName(node: TSESTree.Node, name: string): void {
      if (reported.has(node) || isInsideModuleAugmentation(node)) {
        return
      }
      reported.add(node)
      // 単語帳のマスタで名前を読み（複合語・活用形を含む）、読めない単語を報告する。
      const avoided = findAvoidedTokens(name)
      for (const { word, preferred } of avoided) {
        context.report({ node, messageId: 'avoidedWord', data: { word, preferred, name } })
      }
      const avoidedWords = new Set(avoided.map((item) => item.word))
      for (const word of findUnknownTokens(name).filter((token) => !avoidedWords.has(token))) {
        context.report({ node, messageId: 'unknownWord', data: { word, name } })
      }
    }

    function checkKey(key: TSESTree.Node, computed: boolean): void {
      if (!computed && key.type === AST_NODE_TYPES.Identifier) {
        checkName(key, key.name)
      }
    }

    function checkPattern(pattern: TSESTree.Node | null | undefined): void {
      for (const identifier of collectPatternNames(pattern)) {
        checkName(identifier, identifier.name)
      }
    }

    function checkFunction(node: { id?: TSESTree.Identifier | null; params: TSESTree.Parameter[] }): void {
      if (node.id) {
        checkName(node.id, node.id.name)
      }
      node.params.forEach(checkPattern)
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      TSDeclareFunction: checkFunction,
      TSFunctionType: (node) => node.params.forEach(checkPattern),
      TSMethodSignature(node) {
        checkKey(node.key, node.computed)
        node.params.forEach(checkPattern)
      },
      TSPropertySignature: (node) => checkKey(node.key, node.computed),
      VariableDeclarator: (node) => checkPattern(node.id),
      CatchClause: (node) => checkPattern(node.param),
      ClassDeclaration(node) {
        if (node.id) {
          checkName(node.id, node.id.name)
        }
      },
      MethodDefinition(node) {
        if (node.kind !== 'constructor') {
          checkKey(node.key, node.computed)
        }
      },
      PropertyDefinition: (node) => checkKey(node.key, node.computed),
      TSInterfaceDeclaration: (node) => checkName(node.id, node.id.name),
      TSTypeAliasDeclaration: (node) => checkName(node.id, node.id.name),
      TSEnumDeclaration: (node) => checkName(node.id, node.id.name),
      TSEnumMember: (node) => checkKey(node.id, false),
      TSTypeParameter: (node) => checkName(node.name, node.name.name),
      TSMappedType(node) {
        if (node.key.type === AST_NODE_TYPES.Identifier) {
          checkName(node.key, node.key.name)
        }
      },
      ImportSpecifier(node) {
        const importedName = node.imported.type === AST_NODE_TYPES.Identifier ? node.imported.name : node.imported.value
        if (node.local.name !== importedName) {
          checkName(node.local, node.local.name)
        }
      },
    }
  },
})
