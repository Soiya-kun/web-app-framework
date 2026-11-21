// シナリオとケースの手順（Screen の操作と expect）を、渡した言語（日本語・英語）にする。
import { isActionKey, type LabelKey, type MessageKey } from '@app/vocabulary/text'
import ts from 'typescript'
import type { Language } from '../language'
import { readString, unwrap } from './source'

export type ScreenText = ReturnType<typeof prepareScreenText>

type Constants = ReadonlyMap<string, ts.Expression>

export function prepareScreenText(language: Language) {
  const { text, sentence } = language

  function hasLabel(key: string): boolean {
    return text.label(key as LabelKey) !== key
  }

  /** キーの見出し（なければ単語帳で名詞句にする）。 */
  function labelOf(key: string): string {
    return hasLabel(key) ? text.label(key as LabelKey) : language.noun(key)
  }

  /** 値を訳す。文字列は引用符で、入力の項目は〈項目〉、数は金額。 */
  function valueOf(expression: ts.Expression, constants: Constants = new Map()): string {
    const inner = unwrap(expression)
    const literal = readString(inner)
    if (literal !== undefined) {
      return literal === '' ? sentence.empty : sentence.quote(literal)
    }
    if (ts.isNumericLiteral(inner)) {
      return sentence.amount(Number(inner.text.replace(/_/g, '')))
    }
    if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(inner.operand)) {
      return sentence.amount(-Number(inner.operand.text.replace(/_/g, '')))
    }
    if (ts.isPropertyAccessExpression(inner)) {
      return sentence.slot(labelOf(inner.name.text))
    }
    if (ts.isIdentifier(inner)) {
      const constant = constants.get(inner.text)
      return constant === undefined ? sentence.slot(labelOf(inner.text)) : valueOf(constant, constants)
    }
    if (ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      return valueOf(inner.left, constants)
    }
    if (ts.isObjectLiteralExpression(inner)) {
      return sentence.pairs(readInputs(inner, constants))
    }
    if (ts.isArrayLiteralExpression(inner)) {
      return sentence.list(inner.elements.map((element) => valueOf(element, constants)))
    }
    return `\`${inner.getText().replace(/\s+/g, ' ')}\``
  }

  /** オブジェクトの値を、見出しと値の並びにする（...spread は、元の定数の値を展開する）。 */
  function readInputs(object: ts.ObjectLiteralExpression, constants: Constants = new Map()): { label: string; value: string }[] {
    const inputs: { label: string; value: string }[] = []
    const put = (label: string, value: string) => {
      const index = inputs.findIndex((input) => input.label === label)
      if (index >= 0) {
        inputs.splice(index, 1)
      }
      inputs.push({ label, value })
    }
    for (const property of object.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = unwrap(property.expression)
        const source = ts.isIdentifier(spread) ? constants.get(spread.text) : undefined
        if (source !== undefined && ts.isObjectLiteralExpression(unwrap(source))) {
          readInputs(unwrap(source) as ts.ObjectLiteralExpression, constants).forEach((input) => put(input.label, input.value))
        }
        continue
      }
      if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
        put(labelOf(property.name.text), valueOf(property.initializer, constants))
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        put(labelOf(property.name.text), valueOf(property.name, constants))
      }
    }
    return inputs
  }

  /** 文のキーの文（{field} などはそのまま）。 */
  function messageText(key: string): string {
    return text.message(key as MessageKey)
  }

  function messageOf(keyNode: ts.Expression | undefined, paramsNode: ts.Expression | undefined, field?: string): string {
    const key = keyNode === undefined ? undefined : readString(keyNode)
    if (key === undefined) {
      return keyNode === undefined ? '' : valueOf(keyNode)
    }
    const params = new Map<string, string>()
    if (field !== undefined) {
      params.set('field', field)
    }
    if (paramsNode !== undefined && ts.isObjectLiteralExpression(unwrap(paramsNode))) {
      for (const property of (unwrap(paramsNode) as ts.ObjectLiteralExpression).properties) {
        if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
          const value = unwrap(property.initializer)
          const literal = ts.isNumericLiteral(value) ? value.text.replace(/_/g, '') : readString(value)
          params.set(property.name.text, literal ?? valueOf(value))
        }
      }
    }
    return text.message(key as MessageKey).replace(/\{(\w+)\}/g, (whole, name: string) => params.get(name) ?? whole)
  }

  /** ボタンのキーの文言（ボタンの表になければ見出し）。 */
  function buttonTextOf(key: string): string {
    return isActionKey(key) ? text.action(key) : labelOf(key)
  }

  function buttonOf(node: ts.Expression | undefined): string {
    const key = node === undefined ? undefined : readString(node)
    if (key === undefined) {
      return node === undefined ? '' : valueOf(node)
    }
    return buttonTextOf(key)
  }

  function keyLabel(node: ts.Expression | undefined): string {
    const key = node === undefined ? undefined : readString(node)
    return key === undefined ? (node === undefined ? '' : valueOf(node)) : labelOf(key)
  }

  /**
   * screen.row('a', 'b') の受け手を「「a」・「b」の行で、」にする。
   * screen.rowOf('invoiceList', { closingDate: x }) の受け手は「「請求一覧」の、請求締め日が〈請求締め日〉の行で、」にする。
   */
  function scopeOf(receiver: ts.Expression, constants: Constants): string | undefined {
    const inner = unwrap(receiver)
    if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression) && inner.expression.name.text === 'row') {
      return sentence.rowScope(inner.arguments.map((argument) => valueOf(argument, constants)))
    }
    if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression) && inner.expression.name.text === 'rowOf') {
      const [table, cells] = inner.arguments
      const cellNode = cells === undefined ? undefined : unwrap(cells)
      const conditions =
        cellNode !== undefined && ts.isObjectLiteralExpression(cellNode)
          ? cellNode.properties.flatMap((property) =>
              ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)
                ? [{ label: labelOf(property.name.text), value: valueOf(property.initializer, constants) }]
                : [],
            )
          : []
      return sentence.rowOfScope(keyLabel(table), conditions)
    }
    if (ts.isIdentifier(inner) || ts.isPropertyAccessExpression(inner)) {
      return ''
    }
    return undefined
  }

  /** Screen の操作を手順にする。Screen の操作でなければ undefined。 */
  function translateScreenCall(call: ts.CallExpression, constants: Constants = new Map()): string | undefined {
    if (!ts.isPropertyAccessExpression(call.expression)) {
      return undefined
    }
    const scope = scopeOf(call.expression.expression, constants)
    if (scope === undefined) {
      return undefined
    }
    const [first, second, third] = call.arguments
    const value = (node: ts.Expression | undefined) => (node === undefined ? '' : valueOf(node, constants))
    const step = (() => {
      switch (call.expression.name.text) {
        case 'go':
          return sentence.go(keyLabel(first))
        case 'follow':
          return sentence.follow(value(first))
        case 'fill':
          return sentence.fill(keyLabel(first), value(second))
        case 'choose':
          return sentence.choose(keyLabel(first), value(second))
        case 'press':
          return sentence.press(buttonOf(first))
        case 'expectMessage':
          return sentence.expectMessage(messageOf(first, second))
        case 'expectAlert':
          return sentence.expectAlert(messageOf(first, second))
        case 'expectProblem':
          return sentence.expectProblem(keyLabel(first), messageOf(second, third, keyLabel(first)))
        case 'expectHeading':
          return sentence.expectHeading(keyLabel(first))
        case 'expectCells':
          return sentence.expectCells(keyLabel(first), value(second) === '' ? sentence.givenValues : value(second))
        case 'expectRows':
          return sentence.expectRows(keyLabel(first))
        case 'expectText':
          return sentence.expectText(value(first))
        case 'expectNoButton':
          return sentence.expectNoButton(buttonOf(first))
        case 'expectOptions':
          return sentence.expectOptions(keyLabel(first), value(second))
        default:
          return undefined
      }
    })()
    if (step === undefined) {
      return undefined
    }
    // 行の中の操作は、行の句のあとに続けて読む（英語は手順の頭を小文字にする）。
    return scope === '' || language.locale === 'ja' ? `${scope}${step}` : `${scope}${step.charAt(0).toLowerCase()}${step.slice(1)}`
  }

  /** 旧システムの画面の操作を手順にする。画面・項目・ボタンの名前は、書いた文言のまま出す。 */
  function translateLegacyCall(call: ts.CallExpression, constants: Constants = new Map()): string | undefined {
    if (!ts.isPropertyAccessExpression(call.expression) || !ts.isIdentifier(call.expression.expression)) {
      return undefined
    }
    const [first, second] = call.arguments
    const value = (node: ts.Expression | undefined) => (node === undefined ? '' : valueOf(node, constants))
    const name = (node: ts.Expression | undefined) => readString(node) ?? value(node)
    switch (call.expression.name.text) {
      case 'go':
        return sentence.go(name(first))
      case 'follow':
        return sentence.follow(value(first))
      case 'fill':
        return sentence.fill(name(first), value(second))
      case 'choose':
        return sentence.choose(name(first), value(second))
      case 'press':
        return sentence.press(name(first))
      case 'expectText':
        return sentence.expectText(value(first))
      default:
        return undefined
    }
  }

  /** 関数の本体を、Screen の操作の手順の並びにする（legacy なら旧システムの画面の操作）。Screen の操作でない文は、コードのまま出す。 */
  function translateScreenBody(body: ts.ConciseBody, constants: Constants = new Map(), legacy = false): { steps: string[]; flat: boolean } {
    const statements = ts.isBlock(body) ? [...body.statements] : []
    let flat = ts.isBlock(body)
    const steps = statements.map((statement) => {
      if (ts.isExpressionStatement(statement)) {
        const expression = unwrap(statement.expression)
        if (ts.isCallExpression(expression)) {
          const translated = legacy ? translateLegacyCall(expression, constants) : translateScreenCall(expression, constants)
          if (translated !== undefined) {
            return translated
          }
        }
      }
      flat = false
      return `\`${statement.getText().replace(/\s+/g, ' ')}\``
    })
    return { steps, flat }
  }

  /** 動詞で始まる名前の手順（deliverProduct →「商品を納品する」/ "Deliver product"）。 */
  function translateName(name: string): string {
    return language.step(name) ?? name
  }

  return { language, labelOf, valueOf, readInputs, messageText, buttonTextOf, translateScreenCall, translateScreenBody, translateName }
}
