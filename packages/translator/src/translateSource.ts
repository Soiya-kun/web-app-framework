// TypeScript のソースを読み、export した関数ごとに「関数名の体言止め」と「処理の手順（〜する）」を作る。
// 訳は単語帳の品詞と日本語から機械的に作る。訳せない式は、コードのまま `…` で示す。
import {
  messageList,
  renderNounPhrase,
  splitWords,
  translateFunctionName,
  translateStep,
} from '@app/vocabulary'
import ts from 'typescript'

export type StepTranslation = {
  readonly text: string
  readonly children: readonly StepTranslation[]
}

export type FunctionTranslation = {
  readonly name: string
  readonly title: string
  readonly purpose: string
  readonly parameters: readonly string[]
  readonly steps: readonly StepTranslation[]
  readonly line: number
}

const messageText = new Map<string, string>(messageList.map((entry) => [entry.key, entry.ja]))

export function translateSource(sourceText: string, fileName: string): FunctionTranslation[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

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
      return renderNounPhrase(inner.text, 'ja')
    }
    if (ts.isPropertyAccessExpression(inner)) {
      return `${nounOf(inner.expression)}の${renderNounPhrase(inner.name.text, 'ja')}`
    }
    if (ts.isNumericLiteral(inner)) {
      return inner.text
    }
    if (ts.isObjectLiteralExpression(inner)) {
      const shorthands = inner.properties.filter(ts.isShorthandPropertyAssignment)
      if (shorthands.length === inner.properties.length) {
        return shorthands.map((property) => renderNounPhrase(property.name.text, 'ja')).join('・')
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
    return translateCall(expression) ?? `${code(unwrap(expression))}を実行する`
  }

  /** is・has・can で始まる名前を、条件の句にする。 */
  function conditionOfName(name: string, negated: boolean): string | undefined {
    const [first, ...rest] = splitWords(name)
    const restName = joinCamel(rest)
    if (first === 'is' && rest.length > 0) {
      return `${renderNounPhrase(restName, 'ja')}${negated ? 'でない' : 'である'}`
    }
    if (first === 'has' && rest.length > 0) {
      return `${renderNounPhrase(restName, 'ja')}が${negated ? 'ない' : 'ある'}`
    }
    if (first === 'can' && rest.length > 0) {
      const step = translateStep(restName)
      return step === undefined ? undefined : `${step}ことが${negated ? 'できない' : 'できる'}`
    }
    return undefined
  }

  const comparisonText: Partial<Record<ts.SyntaxKind, string>> = {
    [ts.SyntaxKind.LessThanToken]: 'より小さい',
    [ts.SyntaxKind.GreaterThanToken]: 'より大きい',
    [ts.SyntaxKind.LessThanEqualsToken]: '以下である',
    [ts.SyntaxKind.GreaterThanEqualsToken]: '以上である',
  }

  function isEmptyValue(expression: ts.Expression): boolean {
    return (
      (ts.isStringLiteral(expression) && expression.text === '') ||
      expression.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(expression) && expression.text === 'undefined')
    )
  }

  /** if の条件を「〜」の句にする（後ろに「場合」を付ける）。 */
  function conditionOf(expression: ts.Expression, negated = false): string {
    const inner = unwrap(expression)
    if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.ExclamationToken) {
      return conditionOf(inner.operand, !negated)
    }
    if (!negated && ts.isBinaryExpression(inner)) {
      const operator = inner.operatorToken.kind
      if (operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.AmpersandAmpersandToken) {
        const joiner = operator === ts.SyntaxKind.BarBarToken ? '、または' : '、かつ'
        return `${conditionOf(inner.left)}${joiner}${conditionOf(inner.right)}`
      }
      if (operator === ts.SyntaxKind.EqualsEqualsEqualsToken || operator === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
        const isEqual = operator === ts.SyntaxKind.EqualsEqualsEqualsToken
        if (isEmptyValue(inner.right)) {
          return `${nounOf(inner.left)}が${isEqual ? '空である' : '空でない'}`
        }
        return `${nounOf(inner.left)}が${nounOf(inner.right)}と${isEqual ? '等しい' : '等しくない'}`
      }
      const comparison = comparisonText[operator]
      if (comparison !== undefined) {
        return `${nounOf(inner.left)}が${nounOf(inner.right)}${comparison}`
      }
    }
    if (ts.isIdentifier(inner)) {
      return conditionOfName(inner.text, negated) ?? `${code(inner)}が${negated ? '偽である' : '真である'}`
    }
    if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression)) {
      const condition = conditionOfName(inner.expression.text, negated)
      if (condition !== undefined) {
        return condition
      }
    }
    return negated ? `${code(inner)}が偽である` : `${code(inner)}が真である`
  }

  function throwOf(expression: ts.Expression): string {
    const inner = unwrap(expression)
    if (ts.isCallExpression(inner) || ts.isNewExpression(inner)) {
      const [first] = inner.arguments ?? []
      if (first !== undefined && ts.isStringLiteral(first)) {
        const message = messageText.get(first.text)
        if (message !== undefined) {
          return `エラー「${message}」で止める`
        }
      }
    }
    return `エラー（${code(inner)}）で止める`
  }

  function returnOf(expression: ts.Expression | undefined): string {
    if (expression === undefined) {
      return '終える'
    }
    const call = translateCall(expression)
    if (call !== undefined) {
      return `${call}（その結果を返す）`
    }
    return `${nounOf(expression)}を返す`
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
        const target = ts.isIdentifier(declaration.name) ? renderNounPhrase(declaration.name.text, 'ja') : code(declaration.name)
        const verb = ts.isCallExpression(unwrap(initializer)) || ts.isNewExpression(unwrap(initializer)) ? 'で求める' : 'にする'
        return [{ text: `${target}を${code(unwrap(initializer))}${verb}`, children: [] }]
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
        { text: `${conditionOf(statement.expression)}場合`, children: translateBlock(statement.thenStatement) },
      ]
      if (statement.elseStatement !== undefined) {
        steps.push({ text: 'それ以外の場合', children: translateBlock(statement.elseStatement) })
      }
      return steps
    }
    if (ts.isForOfStatement(statement)) {
      return [{ text: `${nounOf(statement.expression)}の1件ごとに`, children: translateBlock(statement.statement) }]
    }
    if (ts.isBlock(statement)) {
      return translateStatements(statement.statements)
    }
    return [{ text: code(statement), children: [] }]
  }

  function translateStatements(statements: ts.NodeArray<ts.Statement>): StepTranslation[] {
    return statements.flatMap(translateStatement)
  }

  function readPurpose(node: ts.Node): string {
    const [document] = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc)
    return ts.getTextOfJSDocComment(document?.comment) ?? ''
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
      title: translateFunctionName(name),
      purpose: readPurpose(documentNode),
      parameters: node.parameters.map((parameter) =>
        ts.isIdentifier(parameter.name) ? renderNounPhrase(parameter.name.text, 'ja') : code(parameter.name),
      ),
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
