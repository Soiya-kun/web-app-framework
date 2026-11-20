// シナリオとケースの手順（Screen の操作と expect）を日本語にする。
import { renderNounPhrase, translateStep } from '@app/vocabulary'
import { isActionKey, prepareText, type LabelKey, type MessageKey } from '@app/vocabulary/text'
import ts from 'typescript'
import { readString, unwrap } from './source'

const text = prepareText('ja')

function hasLabel(key: string): boolean {
  return text.label(key as LabelKey) !== key
}

/** キーの見出し（なければ単語帳で名詞句にする）。 */
export function labelOf(key: string): string {
  return hasLabel(key) ? text.label(key as LabelKey) : renderNounPhrase(key, 'ja')
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('ja-JP')}円`
}

/** 値を日本語にする。文字列は「…」、入力の項目は〈項目〉、数は金額。 */
export function valueOf(expression: ts.Expression, constants: ReadonlyMap<string, ts.Expression> = new Map()): string {
  const inner = unwrap(expression)
  const literal = readString(inner)
  if (literal !== undefined) {
    return literal === '' ? '空' : `「${literal}」`
  }
  if (ts.isNumericLiteral(inner)) {
    return formatAmount(Number(inner.text.replace(/_/g, '')))
  }
  if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(inner.operand)) {
    return formatAmount(-Number(inner.operand.text.replace(/_/g, '')))
  }
  if (ts.isPropertyAccessExpression(inner)) {
    return `〈${labelOf(inner.name.text)}〉`
  }
  if (ts.isIdentifier(inner)) {
    const constant = constants.get(inner.text)
    return constant === undefined ? `〈${labelOf(inner.text)}〉` : valueOf(constant, constants)
  }
  if (ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    return valueOf(inner.left, constants)
  }
  if (ts.isObjectLiteralExpression(inner)) {
    return readInputs(inner, constants)
      .map((input) => `${input.label} ${input.value}`)
      .join('、')
  }
  if (ts.isArrayLiteralExpression(inner)) {
    return inner.elements.map((element) => valueOf(element, constants)).join('・')
  }
  return `\`${inner.getText().replace(/\s+/g, ' ')}\``
}

/** オブジェクトの値を、見出しと値の並びにする（...spread は、元の定数の値を展開する）。 */
export function readInputs(object: ts.ObjectLiteralExpression, constants: ReadonlyMap<string, ts.Expression> = new Map()): { label: string; value: string }[] {
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
export function messageText(key: string): string {
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
export function buttonTextOf(key: string): string {
  return isActionKey(key) ? text.action(key) : labelOf(key)
}

function buttonOf(node: ts.Expression | undefined): string {
  const key = node === undefined ? undefined : readString(node)
  if (key === undefined) {
    return node === undefined ? '' : valueOf(node)
  }
  return isActionKey(key) ? text.action(key) : labelOf(key)
}

function keyLabel(node: ts.Expression | undefined): string {
  const key = node === undefined ? undefined : readString(node)
  return key === undefined ? (node === undefined ? '' : valueOf(node)) : labelOf(key)
}

/**
 * screen.row('a', 'b') の受け手を「「a」・「b」の行で、」にする。
 * screen.rowOf('invoiceList', { closingDate: x }) の受け手は「「請求一覧」の、請求締め日が〈請求締め日〉の行で、」にする。
 */
function scopeOf(receiver: ts.Expression, constants: ReadonlyMap<string, ts.Expression>): string | undefined {
  const inner = unwrap(receiver)
  if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression) && inner.expression.name.text === 'row') {
    return `${inner.arguments.map((argument) => valueOf(argument, constants)).join('・')}の行で、`
  }
  if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression) && inner.expression.name.text === 'rowOf') {
    const [table, cells] = inner.arguments
    const cellNode = cells === undefined ? undefined : unwrap(cells)
    const conditions =
      cellNode !== undefined && ts.isObjectLiteralExpression(cellNode)
        ? cellNode.properties.flatMap((property) =>
            ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) ? [`${labelOf(property.name.text)}が${valueOf(property.initializer, constants)}`] : [],
          )
        : []
    return `「${keyLabel(table)}」の、${conditions.join('・')}の行で、`
  }
  if (ts.isIdentifier(inner) || ts.isPropertyAccessExpression(inner)) {
    return ''
  }
  return undefined
}

/** Screen の操作を日本語の手順にする。Screen の操作でなければ undefined。 */
export function translateScreenCall(call: ts.CallExpression, constants: ReadonlyMap<string, ts.Expression> = new Map()): string | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) {
    return undefined
  }
  const scope = scopeOf(call.expression.expression, constants)
  if (scope === undefined) {
    return undefined
  }
  const [first, second, third] = call.arguments
  const value = (node: ts.Expression | undefined) => (node === undefined ? '' : valueOf(node, constants))
  const sentence = (() => {
    switch (call.expression.name.text) {
      case 'go':
        return `「${keyLabel(first)}」を開く`
      case 'follow':
        return `${value(first)}のリンクをたどる`
      case 'fill':
        return `${keyLabel(first)}に${value(second)}を入れる`
      case 'choose':
        return `${keyLabel(first)}で${value(second)}を選ぶ`
      case 'press':
        return `「${buttonOf(first)}」を押す`
      case 'expectMessage':
        return `「${messageOf(first, second)}」と出ることを確かめる`
      case 'expectAlert':
        return `警告「${messageOf(first, second)}」が出ることを確かめる`
      case 'expectProblem':
        return `${keyLabel(first)}に「${messageOf(second, third, keyLabel(first))}」と出ることを確かめる`
      case 'expectHeading':
        return `「${keyLabel(first)}」の画面になったことを確かめる`
      case 'expectCells':
        return `「${keyLabel(first)}」の1行目が、${value(second) === '' ? '（指定した値）' : value(second)}であることを確かめる`
      case 'expectRows':
        return `「${keyLabel(first)}」の行を確かめる`
      case 'expectText':
        return `${value(first)}と出ることを確かめる`
      case 'expectNoButton':
        return `「${buttonOf(first)}」のボタンが出ていないことを確かめる`
      case 'expectOptions':
        return `${keyLabel(first)}の選択肢が${value(second)}であることを確かめる`
      default:
        return undefined
    }
  })()
  return sentence === undefined ? undefined : `${scope}${sentence}`
}

/** 関数の本体を、Screen の操作の手順の並びにする。Screen の操作でない文は、コードのまま出す。 */
export function translateScreenBody(body: ts.ConciseBody, constants: ReadonlyMap<string, ts.Expression> = new Map()): { steps: string[]; flat: boolean } {
  const statements = ts.isBlock(body) ? [...body.statements] : []
  let flat = ts.isBlock(body)
  const steps = statements.map((statement) => {
    if (ts.isExpressionStatement(statement)) {
      const expression = unwrap(statement.expression)
      if (ts.isCallExpression(expression)) {
        const translated = translateScreenCall(expression, constants)
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

/** 動詞で始まる名前の手順（deliverProduct →「商品を納品する」）。 */
export function translateName(name: string): string {
  return translateStep(name) ?? name
}
