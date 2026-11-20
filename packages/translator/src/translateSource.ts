// TypeScript のソースを読み、export した関数ごとに「関数名の見出し」と「処理の手順」を作る（日本語は体言止めと「〜する」、英語は命令形）。
// 訳は単語帳の品詞と語形から機械的に作る。訳せない式は、コードのまま `…` で示す。
import { splitWords } from '@app/vocabulary'
import ts from 'typescript'
import { prepareLanguage, type Comparison, type Language } from './language'

export type StepTranslation = {
  readonly text: string
  readonly children: readonly StepTranslation[]
}

export type FunctionTranslation = {
  readonly name: string
  readonly title: string
  readonly parameters: readonly string[]
  readonly steps: readonly StepTranslation[]
  readonly line: number
}

export function translateSource(sourceText: string, fileName: string, language: Language = prepareLanguage('ja')): FunctionTranslation[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const { noun, phrase, step: translateStep, sentence } = language

  function code(node: ts.Node): string {
    return `\`${node.getText(sourceFile).replace(/\s+/g, ' ')}\``
  }

  function joinCamel(tokens: readonly string[]): string {
    return tokens.map((token, index) => (index === 0 ? token : token.charAt(0).toUpperCase() + token.slice(1))).join('')
  }

  function unwrap(expression: ts.Expression): ts.Expression {
    if (ts.isAwaitExpression(expression) || ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression)) {
      return unwrap(expression.expression)
    }
    if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) {
      return unwrap(expression.expression)
    }
    return expression
  }

  /** 値を名詞句にする（salesAmount →「売上金額」）。 */
  function nounOf(expression: ts.Expression): string {
    const inner = unwrap(expression)
    if (ts.isIdentifier(inner)) {
      return phrase(inner.text)
    }
    if (ts.isPropertyAccessExpression(inner)) {
      return sentence.owned(nounOf(inner.expression), phrase(inner.name.text))
    }
    if (ts.isNumericLiteral(inner)) {
      return inner.text
    }
    if (ts.isObjectLiteralExpression(inner)) {
      const shorthands = inner.properties.filter(ts.isShorthandPropertyAssignment)
      if (shorthands.length === inner.properties.length) {
        return sentence.list(shorthands.map((property) => phrase(property.name.text)))
      }
    }
    return code(inner)
  }

  /** 呼び出しを手順にする。訳せなければ undefined。 */
  function translateCall(expression: ts.Expression): string | undefined {
    const inner = unwrap(expression)
    if (!ts.isCallExpression(inner)) {
      return undefined
    }
    const callee = inner.expression
    if (ts.isIdentifier(callee)) {
      return translateStep(callee.text)
    }
    if (ts.isPropertyAccessExpression(callee)) {
      const receiver = callee.expression
      const receiverName = ts.isIdentifier(receiver)
        ? receiver.text
        : ts.isPropertyAccessExpression(receiver)
          ? receiver.name.text
          : undefined
      return translateStep(callee.name.text, receiverName)
    }
    return undefined
  }

  function stepOf(expression: ts.Expression): string {
    return translateCall(expression) ?? sentence.run(code(unwrap(expression)))
  }

  /** is・has・can で始まる名前を、条件の句にする。 */
  function conditionOfName(name: string, negated: boolean): string | undefined {
    const [first, ...rest] = splitWords(name)
    const restName = joinCamel(rest)
    if (first === 'is' && rest.length > 0) {
      return sentence.isName(phrase(restName), negated)
    }
    if (first === 'has' && rest.length > 0) {
      return sentence.hasName(phrase(restName), negated)
    }
    if (first === 'can' && rest.length > 0) {
      const step = translateStep(restName)
      return step === undefined ? undefined : sentence.canName(step, negated)
    }
    return undefined
  }

  const comparisons: Partial<Record<ts.SyntaxKind, Comparison>> = {
    [ts.SyntaxKind.LessThanToken]: 'less',
    [ts.SyntaxKind.GreaterThanToken]: 'greater',
    [ts.SyntaxKind.LessThanEqualsToken]: 'atMost',
    [ts.SyntaxKind.GreaterThanEqualsToken]: 'atLeast',
  }

  function isEmptyValue(expression: ts.Expression): boolean {
    return (
      (ts.isStringLiteral(expression) && expression.text === '') ||
      expression.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(expression) && expression.text === 'undefined')
    )
  }

  /** if の条件を句にする（日本語は後ろに「場合」、英語は前に If を付ける）。 */
  function conditionOf(expression: ts.Expression, negated = false): string {
    const inner = unwrap(expression)
    if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.ExclamationToken) {
      return conditionOf(inner.operand, !negated)
    }
    if (!negated && ts.isBinaryExpression(inner)) {
      const operator = inner.operatorToken.kind
      if (operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.AmpersandAmpersandToken) {
        return operator === ts.SyntaxKind.BarBarToken
          ? sentence.either(conditionOf(inner.left), conditionOf(inner.right))
          : sentence.both(conditionOf(inner.left), conditionOf(inner.right))
      }
      if (operator === ts.SyntaxKind.EqualsEqualsEqualsToken || operator === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
        const isEqual = operator === ts.SyntaxKind.EqualsEqualsEqualsToken
        if (isEmptyValue(inner.right)) {
          return sentence.isEmpty(nounOf(inner.left), !isEqual)
        }
        return sentence.equals(nounOf(inner.left), nounOf(inner.right), !isEqual)
      }
      const comparison = comparisons[operator]
      if (comparison !== undefined) {
        return sentence.compare(nounOf(inner.left), nounOf(inner.right), comparison)
      }
    }
    if (ts.isIdentifier(inner)) {
      return conditionOfName(inner.text, negated) ?? sentence.truth(code(inner), negated)
    }
    if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression)) {
      const condition = conditionOfName(inner.expression.text, negated)
      if (condition !== undefined) {
        return condition
      }
    }
    return sentence.truth(code(inner), negated)
  }

  function throwOf(expression: ts.Expression): string {
    const inner = unwrap(expression)
    if (ts.isCallExpression(inner) || ts.isNewExpression(inner)) {
      const [first] = inner.arguments ?? []
      if (first !== undefined && ts.isStringLiteral(first)) {
        const message = language.messages.get(first.text)
        if (message !== undefined) {
          return sentence.stopWithMessage(message)
        }
      }
    }
    return sentence.stopWithCode(code(inner))
  }

  function returnOf(expression: ts.Expression | undefined): string {
    if (expression === undefined) {
      return sentence.finish
    }
    const call = translateCall(expression)
    if (call !== undefined) {
      return sentence.returnCall(call)
    }
    return sentence.returnValue(nounOf(expression))
  }

  function translateBlock(statement: ts.Statement): StepTranslation[] {
    return ts.isBlock(statement) ? translateStatements(statement.statements) : translateStatement(statement)
  }

  function translateStatement(statement: ts.Statement): StepTranslation[] {
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.flatMap((declaration) => {
        const initializer = declaration.initializer
        if (initializer === undefined) {
          return []
        }
        const call = translateCall(initializer)
        if (call !== undefined) {
          return [{ text: call, children: [] }]
        }
        const target = ts.isIdentifier(declaration.name) ? phrase(declaration.name.text) : code(declaration.name)
        const isComputed = ts.isCallExpression(unwrap(initializer)) || ts.isNewExpression(unwrap(initializer))
        return [{ text: isComputed ? sentence.compute(target, code(unwrap(initializer))) : sentence.assign(target, code(unwrap(initializer))), children: [] }]
      })
    }
    if (ts.isExpressionStatement(statement)) {
      return [{ text: stepOf(statement.expression), children: [] }]
    }
    if (ts.isReturnStatement(statement)) {
      return [{ text: returnOf(statement.expression), children: [] }]
    }
    if (ts.isThrowStatement(statement)) {
      return [{ text: throwOf(statement.expression), children: [] }]
    }
    if (ts.isIfStatement(statement)) {
      const steps: StepTranslation[] = [
        { text: sentence.when(conditionOf(statement.expression)), children: translateBlock(statement.thenStatement) },
      ]
      if (statement.elseStatement !== undefined) {
        steps.push({ text: sentence.otherwise, children: translateBlock(statement.elseStatement) })
      }
      return steps
    }
    if (ts.isForOfStatement(statement)) {
      return [{ text: sentence.each(nounOf(statement.expression)), children: translateBlock(statement.statement) }]
    }
    if (ts.isBlock(statement)) {
      return translateStatements(statement.statements)
    }
    return [{ text: code(statement), children: [] }]
  }

  function translateStatements(statements: ts.NodeArray<ts.Statement>): StepTranslation[] {
    return statements.flatMap(translateStatement)
  }

  function isExported(statement: ts.Statement): boolean {
    return ts.canHaveModifiers(statement) && (ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  }

  function translateFunction(
    name: string,
    node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
    documentNode: ts.Node,
  ): FunctionTranslation {
    const body = node.body
    const steps =
      body === undefined
        ? []
        : ts.isBlock(body)
          ? translateStatements(body.statements)
          : [{ text: returnOf(body), children: [] }]
    return {
      name,
      title: language.title(name),
      parameters: node.parameters.map((parameter) => (ts.isIdentifier(parameter.name) ? noun(parameter.name.text) : code(parameter.name))),
      steps,
      line: sourceFile.getLineAndCharacterOfPosition(documentNode.getStart(sourceFile)).line + 1,
    }
  }

  const results: FunctionTranslation[] = []
  for (const statement of sourceFile.statements) {
    if (!isExported(statement)) {
      continue
    }
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined && statement.body !== undefined) {
      results.push(translateFunction(statement.name.text, statement, statement))
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer
        if (
          ts.isIdentifier(declaration.name) &&
          initializer !== undefined &&
          (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        ) {
          results.push(translateFunction(declaration.name.text, initializer, statement))
        }
      }
    }
  }
  return results
}
