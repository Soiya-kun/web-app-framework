import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'

/** 引数・変数の宣言（分割代入を含む）から、自分で名前を付けた識別子を集める。 */
export function collectPatternNames(pattern: TSESTree.Node | null | undefined): TSESTree.Identifier[] {
  if (pattern === null || pattern === undefined) {
    return []
  }
  switch (pattern.type) {
    case AST_NODE_TYPES.Identifier:
      return [pattern]
    case AST_NODE_TYPES.ObjectPattern:
      return pattern.properties.flatMap((property) =>
        property.type === AST_NODE_TYPES.RestElement ? collectPatternNames(property.argument) : collectPatternNames(property.value),
      )
    case AST_NODE_TYPES.ArrayPattern:
      return pattern.elements.flatMap((element) => collectPatternNames(element))
    case AST_NODE_TYPES.RestElement:
      return collectPatternNames(pattern.argument)
    case AST_NODE_TYPES.AssignmentPattern:
      return collectPatternNames(pattern.left)
    case AST_NODE_TYPES.TSParameterProperty:
      return collectPatternNames(pattern.parameter)
    default:
      return []
  }
}
