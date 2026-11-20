// 業務フロー・シナリオ・ケースを読む（apps/web/flow・apps/web/scenario）。書き方の規則に合わないところは problems に出す。
import { findUnknownTokens, renderNounPhrase, startsWithVerb } from '@app/vocabulary'
import ts from 'typescript'
import { labelOf, messageText, readInputs, translateName, translateScreenBody, translateScreenCall, valueOf } from './screenText'
import { collectCalls, lineOf, listExportedCalls, readProperty, readString, unwrap, type ParsedSource, type SourceReader } from './source'
import type { CaseNode, FlowExtensionNode, FlowNode, FlowStepNode, ModelInput, ModelProblem } from './types'

export const scenarioRoot = 'apps/web/scenario'
export const flowRoot = 'apps/web/flow'

export type ScenarioDraft = {
  readonly id: string
  readonly variable: string
  readonly title: string
  readonly actor: string
  readonly pending: boolean
  /** operate の本体（画面のつながりを読むのに使う）。 */
  readonly operateBody: ts.ConciseBody | null
  readonly steps: string[]
  readonly guarantee: string[]
  readonly extensions: { readonly name: string; readonly condition: string; readonly handling: string[] | null }[]
  readonly file: string
  readonly line: number
}

export type FlowModelDraft = {
  readonly scenarios: ScenarioDraft[]
  readonly cases: Map<string, { testFile: string; cases: CaseNode[] }>
  readonly flows: FlowNode[]
  readonly problems: ModelProblem[]
}

function topLevelConstants(parsed: ParsedSource): Map<string, ts.Expression> {
  const constants = new Map<string, ts.Expression>()
  for (const statement of parsed.source.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer !== undefined) {
          constants.set(declaration.name.text, declaration.initializer)
        }
      }
    }
  }
  return constants
}

function functionBodyOf(expression: ts.Expression | undefined): { body: ts.ConciseBody; parameters: readonly ts.ParameterDeclaration[] } | null {
  if (expression === undefined) {
    return null
  }
  const inner = unwrap(expression)
  return ts.isArrowFunction(inner) || ts.isFunctionExpression(inner) ? { body: inner.body, parameters: inner.parameters } : null
}

function checkName(problems: ModelProblem[], place: { file: string; line: number }, rule: string, name: string, verbFirst: boolean | null): void {
  const unknown = findUnknownTokens(name)
  if (unknown.length > 0) {
    problems.push({ ...place, rule, message: `「${name}」の単語「${unknown.join('・')}」が単語帳にない` })
  }
  if (verbFirst === true && !startsWithVerb(name)) {
    problems.push({ ...place, rule, message: `「${name}」は動詞で始める（手順を表す名前）` })
  }
  if (verbFirst === false && startsWithVerb(name)) {
    problems.push({ ...place, rule, message: `「${name}」は名詞句にする（業務フローの名前）` })
  }
}

function readScenarios(reader: SourceReader, problems: ModelProblem[]): ScenarioDraft[] {
  const files = reader.list(scenarioRoot, (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  return files.flatMap((file) => {
    const parsed = reader.read(file)
    return listExportedCalls(parsed, 'defineScenario').flatMap(({ name: variable, call }) => {
      const place = { file, line: lineOf(parsed, call) }
      const name = readString(call.arguments[0]) ?? variable
      const options = call.arguments[1]
      if (options === undefined || !ts.isObjectLiteralExpression(options)) {
        problems.push({ ...place, rule: 'scenario-form', message: `シナリオ「${name}」の2つめの引数は { actor, operate, confirm, extensions } にする` })
        return []
      }
      if (name !== variable) {
        problems.push({ ...place, rule: 'scenario-name', message: `シナリオの名前「${name}」を変数の名前「${variable}」と同じにする` })
      }
      checkName(problems, place, 'scenario-name', name, true)
      const actor = readString(readProperty(options, 'actor')) ?? ''
      checkName(problems, place, 'actor', actor, null)
      const operate = functionBodyOf(readProperty(options, 'operate'))
      const confirm = functionBodyOf(readProperty(options, 'confirm'))
      const operateSteps = operate === null ? { steps: [], flat: true } : translateScreenBody(operate.body)
      const confirmSteps = confirm === null ? { steps: [], flat: true } : translateScreenBody(confirm.body)
      if (!operateSteps.flat || !confirmSteps.flat) {
        problems.push({ ...place, rule: 'scenario-flat', message: `シナリオ「${name}」の operate・confirm は、画面の操作（await screen.…）を並べるだけにする` })
      }
      if (operate !== null && !(operateSteps.steps[0] ?? '').endsWith('を開く')) {
        problems.push({ ...place, rule: 'scenario-start', message: `シナリオ「${name}」は、画面を開く（screen.go）ところから始める（1人が1回の操作で目的を果たす）` })
      }
      const extensionsNode = readProperty(options, 'extensions')
      const extensions =
        extensionsNode !== undefined && ts.isObjectLiteralExpression(extensionsNode)
          ? extensionsNode.properties.flatMap((property) => {
              if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name) || !ts.isObjectLiteralExpression(property.initializer)) {
                return []
              }
              checkName(problems, { file, line: lineOf(parsed, property) }, 'extension-name', property.name.text, null)
              const handling = functionBodyOf(readProperty(property.initializer, 'confirm'))
              return [
                {
                  name: property.name.text,
                  condition: readString(readProperty(property.initializer, 'condition')) ?? property.name.text,
                  handling: handling === null ? null : translateScreenBody(handling.body).steps,
                },
              ]
            })
          : []
      return [
        {
          id: name,
          variable,
          title: translateName(name),
          actor,
          pending: operate === null,
          operateBody: operate?.body ?? null,
          steps: operateSteps.steps,
          guarantee: confirmSteps.steps,
          extensions,
          file,
          line: place.line,
        },
      ]
    })
  })
}

/** ケースの rows（each の値の表）。 */
function readRows(node: ts.Expression | undefined): Record<string, string>[] {
  const inner = node === undefined ? undefined : unwrap(node)
  if (inner === undefined || !ts.isArrayLiteralExpression(inner)) {
    return []
  }
  return inner.elements.flatMap((element) => {
    if (!ts.isObjectLiteralExpression(element)) {
      return []
    }
    return [
      Object.fromEntries(
        element.properties.flatMap((property) => {
          if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
            return []
          }
          const value = unwrap(property.initializer)
          const literal = readString(value)
          // 列は見出しの日本語にする（messageKey は、文のキーでなく文そのものを出す）。
          if (property.name.text === 'messageKey' && literal !== undefined) {
            return [[labelOf('message'), messageText(literal)]]
          }
          return [[labelOf(property.name.text), literal === '' ? '空' : (literal ?? value.getText())]]
        }),
      ),
    ]
  })
}

type CaseHelper = { readonly body: ts.ConciseBody; readonly parameters: readonly ts.ParameterDeclaration[] }

/** オブジェクトの値の、...spread を定数から展開した項目の名前と値。 */
function flattenObject(node: ts.Expression | undefined, constants: ReadonlyMap<string, ts.Expression>, depth = 0): ts.ObjectLiteralElementLike[] {
  const inner = node === undefined ? undefined : unwrap(node)
  const resolved = inner !== undefined && ts.isIdentifier(inner) ? constants.get(inner.text) : inner
  const object = resolved === undefined ? undefined : unwrap(resolved)
  if (object === undefined || !ts.isObjectLiteralExpression(object) || depth > 3) {
    return []
  }
  return object.properties.flatMap((property) => (ts.isSpreadAssignment(property) ? flattenObject(property.expression, constants, depth + 1) : [property]))
}

/** ケースで変えた値（...spread で元にした値を除く）を「売上金額を「0」」の形にする。 */
function describeChanges(node: ts.Expression | undefined, constants: ReadonlyMap<string, ts.Expression>): string[] {
  const inner = node === undefined ? undefined : unwrap(node)
  const resolved = inner !== undefined && ts.isIdentifier(inner) ? constants.get(inner.text) : inner
  const object = resolved === undefined ? undefined : unwrap(resolved)
  if (object === undefined || !ts.isObjectLiteralExpression(object) || !object.properties.some(ts.isSpreadAssignment)) {
    return []
  }
  return object.properties.flatMap((property) => {
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
      return [`${labelOf(property.name.text)}を${valueOf(property.initializer, constants)}`]
    }
    if (ts.isShorthandPropertyAssignment(property)) {
      return [`${labelOf(property.name.text)}を〈${labelOf(property.name.text)}〉`]
    }
    return []
  })
}

/** ケースの中身を日本語の手順にする。同じファイルの補助の関数は、引数を置き換えて中身を展開する。 */
function translateCaseBody(
  body: ts.ConciseBody,
  helpers: ReadonlyMap<string, CaseHelper>,
  constants: ReadonlyMap<string, ts.Expression>,
  scenarioTitles: ReadonlyMap<string, string>,
  depth = 0,
): string[] {
  const statements = ts.isBlock(body) ? [...body.statements] : []
  return statements.flatMap((statement): string[] => {
    const expression = ts.isExpressionStatement(statement)
      ? unwrap(statement.expression)
      : ts.isVariableStatement(statement)
        ? (() => {
            const initializer = statement.declarationList.declarations[0]?.initializer
            return initializer === undefined ? undefined : unwrap(initializer)
          })()
        : undefined
    if (ts.isReturnStatement(statement)) {
      return []
    }
    if (expression === undefined || !ts.isCallExpression(expression)) {
      return [`\`${statement.getText().replace(/\s+/g, ' ')}\``]
    }
    const callee = expression.expression
    if (ts.isIdentifier(callee)) {
      const helper = helpers.get(callee.text)
      if (helper !== undefined && depth < 2) {
        const bound = new Map(constants)
        helper.parameters.forEach((parameter, index) => {
          const argument = expression.arguments[index]
          if (ts.isIdentifier(parameter.name) && argument !== undefined) {
            bound.set(parameter.name.text, argument)
          }
        })
        return translateCaseBody(helper.body, helpers, bound, scenarioTitles, depth + 1)
      }
      if (callee.text === 'launchApp') {
        const [seed] = expression.arguments
        const tables = [
          ...new Set(
            flattenObject(seed, constants).flatMap((property) =>
              (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && ts.isIdentifier(property.name) ? [labelOf(property.name.text)] : [],
            ),
          ),
        ]
        return [tables.length === 0 ? '画面を開く' : `画面を開く（DB に${tables.join('・')}の行を入れておく）`]
      }
      if (callee.text === 'operateScenario') {
        const [scenario, , input] = expression.arguments
        const title = scenario !== undefined && ts.isIdentifier(scenario) ? (scenarioTitles.get(scenario.text) ?? scenario.text) : ''
        const changes = describeChanges(input, constants)
        return [changes.length === 0 ? `${title}` : `${title}（${changes.join('、')}にして）`]
      }
      if (callee.text === 'confirmScenario') {
        return ['成功の保証を確かめる']
      }
      if (callee.text === 'confirmExtension') {
        return ['拡張の扱いを確かめる']
      }
    }
    const screenStep = translateScreenCall(expression, constants)
    if (screenStep !== undefined) {
      return [screenStep]
    }
    const expectCall = collectCalls(expression).find((call) => ts.isIdentifier(call.expression) && call.expression.text === 'expect')
    if (expectCall !== undefined) {
      const subject = expectCall.arguments[0]?.getText() ?? ''
      const table = /database\.(\w+)/.exec(subject)?.[1]
      const isEmpty = /\.toEqual\(\[\]\)$/.test(expression.getText())
      if (table !== undefined) {
        return [`DB の${labelOf(table)}${isEmpty ? 'が空である' : 'の行が期待どおりである'}ことを確かめる`]
      }
      const subjectCall = expectCall.arguments[0] === undefined ? undefined : unwrap(expectCall.arguments[0])
      if (subjectCall !== undefined && ts.isCallExpression(subjectCall) && ts.isIdentifier(subjectCall.expression) && startsWithVerb(subjectCall.expression.text)) {
        const [, ...rest] = subjectCall.expression.text.split(/(?=[A-Z])/)
        const noun = rest.join('')
        return [`${renderNounPhrase(noun.charAt(0).toLowerCase() + noun.slice(1), 'ja')}が期待どおりであることを確かめる`]
      }
      return [`\`${subject}\` が期待どおりであることを確かめる`]
    }
    return [`\`${statement.getText().replace(/\s+/g, ' ')}\``]
  })
}

function readCases(reader: SourceReader, scenarios: readonly ScenarioDraft[], problems: ModelProblem[]): Map<string, { testFile: string; cases: CaseNode[] }> {
  const result = new Map<string, { testFile: string; cases: CaseNode[] }>()
  const scenarioByPlace = new Map(scenarios.map((scenario) => [`${scenario.file}#${scenario.variable}`, scenario]))
  for (const file of reader.list(scenarioRoot, (path) => path.endsWith('.test.tsx') || path.endsWith('.test.ts'))) {
    const parsed = reader.read(file)
    const helpers = new Map<string, CaseHelper>()
    const scenarioTitles = new Map<string, string>()
    for (const [local, imported] of parsed.imports) {
      const scenario = scenarioByPlace.get(`${imported.file}#${imported.name}`)
      if (scenario !== undefined) {
        scenarioTitles.set(local, scenario.title)
      }
    }
    for (const statement of parsed.source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name !== undefined && statement.body !== undefined) {
        helpers.set(statement.name.text, { body: statement.body, parameters: statement.parameters })
      }
    }
    const constants = topLevelConstants(parsed)
    for (const statement of parsed.source.statements) {
      if (!ts.isExpressionStatement(statement)) {
        continue
      }
      const call = unwrap(statement.expression)
      const isDescribeScenario = ts.isCallExpression(call) && ts.isIdentifier(call.expression) && call.expression.text === 'describeScenario'
      if (!isDescribeScenario) {
        problems.push({ file, line: lineOf(parsed, statement), rule: 'case-place', message: 'シナリオのテストのファイルには、describeScenario だけを書く（describe・test を直接書かない）' })
        continue
      }
      const [scenarioNode, bodyNode] = call.arguments
      const imported = scenarioNode !== undefined && ts.isIdentifier(scenarioNode) ? parsed.imports.get(scenarioNode.text) : undefined
      const scenario = imported === undefined ? undefined : scenarioByPlace.get(`${imported.file}#${imported.name}`)
      if (scenario === undefined) {
        problems.push({ file, line: lineOf(parsed, call), rule: 'case-place', message: 'describeScenario には、apps/web/scenario の defineScenario を渡す' })
        continue
      }
      if (file !== scenario.file.replace(/\.ts$/, '.test.tsx')) {
        problems.push({ file, line: lineOf(parsed, call), rule: 'case-place', message: `シナリオ「${scenario.id}」のケースは ${scenario.file.replace(/\.ts$/, '.test.tsx')} に書く` })
      }
      const body = functionBodyOf(bodyNode)
      const cases: CaseNode[] = []
      if (body !== null) {
        for (const caseCall of collectCalls(body.body)) {
          if (!ts.isPropertyAccessExpression(caseCall.expression) || !ts.isIdentifier(caseCall.expression.expression)) {
            continue
          }
          const method = caseCall.expression.name.text
          const args = caseCall.arguments
          const kind = method.startsWith('main') ? 'main' : method.startsWith('vary') ? 'vary' : method.startsWith('extend') ? 'extend' : null
          if (kind === null) {
            continue
          }
          const isEach = method.endsWith('Each')
          const offset = kind === 'extend' ? 1 : 0
          const extension = kind === 'extend' ? (readString(args[0]) ?? null) : null
          const rows = isEach ? readRows(args[offset]) : []
          const title = readString(args[offset + (isEach ? 1 : 0)]) ?? ''
          const run = functionBodyOf(args[offset + (isEach ? 2 : 1)])
          cases.push({
            kind,
            extension,
            title,
            pending: run === null,
            rows,
            steps: run === null ? [] : translateCaseBody(run.body, helpers, constants, scenarioTitles),
            file,
            line: lineOf(parsed, caseCall),
          })
        }
      }
      if (cases.filter((caseNode) => caseNode.kind === 'main').length > 1) {
        problems.push({ file, line: lineOf(parsed, call), rule: 'case-main', message: `シナリオ「${scenario.id}」の主成功シナリオ（cases.main）は1つにする` })
      }
      result.set(scenario.id, { testFile: file, cases })
    }
  }
  return result
}

function readFlowSteps(
  parsed: ParsedSource,
  elements: readonly ts.Expression[],
  prefix: string,
  constants: ReadonlyMap<string, ts.Expression>,
  scenarios: ReadonlyMap<string, ScenarioDraft>,
  flowNames: ReadonlyMap<string, string>,
  problems: ModelProblem[],
): FlowStepNode[] {
  const extensionLetters = 'abcdefghijklmnopqrstuvwxyz'
  return elements.flatMap((element, index): FlowStepNode[] => {
    const call = unwrap(element)
    const number = `${prefix}${index + 1}`
    const place = { file: parsed.file, line: lineOf(parsed, element) }
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) {
      problems.push({ ...place, rule: 'flow-step', message: '業務フローの段は operate・outside・occur・elapse・nest の呼び出しにする' })
      return []
    }
    const kind = call.expression.text
    const [first, second, third] = call.arguments
    const inputsOf = (node: ts.Expression | undefined): ModelInput[] => {
      const inner = node === undefined ? undefined : unwrap(node)
      if (inner === undefined) {
        return []
      }
      const resolved = ts.isIdentifier(inner) ? constants.get(inner.text) : inner
      return resolved !== undefined && ts.isObjectLiteralExpression(unwrap(resolved)) ? readInputs(unwrap(resolved) as ts.ObjectLiteralExpression, constants) : []
    }
    const base = { number, actor: null, actorTitle: null, scenarioId: null, flowId: null, inputs: [], extensions: [], ...place }
    if (kind === 'operate') {
      const imported = first !== undefined && ts.isIdentifier(first) ? parsed.imports.get(first.text) : undefined
      const scenario = imported === undefined ? undefined : scenarios.get(`${imported.file}#${imported.name}`)
      if (scenario === undefined) {
        problems.push({ ...place, rule: 'flow-step', message: 'operate には、apps/web/scenario の defineScenario を渡す' })
        return []
      }
      const extensionsNode = third === undefined ? undefined : unwrap(third)
      const extensions: FlowExtensionNode[] =
        extensionsNode !== undefined && ts.isObjectLiteralExpression(extensionsNode)
          ? extensionsNode.properties.flatMap((property, extensionIndex) => {
              if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name) || !ts.isObjectLiteralExpression(property.initializer)) {
                return []
              }
              const key = `${number}${extensionLetters[extensionIndex] ?? extensionIndex}`
              const thenNode = readProperty(property.initializer, 'then')
              const resumeNode = readProperty(property.initializer, 'resume')
              return [
                {
                  key,
                  name: property.name.text,
                  condition: scenario.extensions.find((extension) => extension.name === property.name.getText())?.condition ?? property.name.text,
                  inputs: inputsOf(readProperty(property.initializer, 'input')),
                  then:
                    thenNode !== undefined && ts.isArrayLiteralExpression(thenNode)
                      ? readFlowSteps(parsed, thenNode.elements, `${key}.`, constants, scenarios, flowNames, problems)
                      : [],
                  resume: resumeNode?.kind !== ts.SyntaxKind.FalseKeyword,
                },
              ]
            })
          : []
      return [
        {
          ...base,
          kind: 'operate',
          title: scenario.title,
          actor: scenario.actor,
          actorTitle: renderNounPhrase(scenario.actor, 'ja'),
          scenarioId: scenario.id,
          inputs: inputsOf(second),
          extensions,
        },
      ]
    }
    if (kind === 'outside' || kind === 'occur') {
      const actor = readString(first) ?? ''
      const name = readString(second) ?? ''
      checkName(problems, place, 'step-name', actor, null)
      checkName(problems, place, 'step-name', name, true)
      return [{ ...base, kind, title: translateName(name), actor, actorTitle: renderNounPhrase(actor, 'ja') }]
    }
    if (kind === 'elapse') {
      const time = readString(first) ?? ''
      const date = readString(second) ?? ''
      checkName(problems, place, 'elapse', time, false)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        problems.push({ ...place, rule: 'elapse', message: `時の経過の日付「${date}」は YYYY-MM-DD にする` })
      }
      return [{ ...base, kind, title: `${labelOf(time)}になる（${date}）` }]
    }
    if (kind === 'nest') {
      const imported = first !== undefined && ts.isIdentifier(first) ? parsed.imports.get(first.text) : undefined
      const flowName = imported === undefined ? undefined : flowNames.get(`${imported.file}#${imported.name}`)
      if (flowName === undefined) {
        problems.push({ ...place, rule: 'flow-step', message: 'nest には、apps/web/flow の defineFlow を渡す' })
        return []
      }
      return [{ ...base, kind, title: renderNounPhrase(flowName, 'ja'), flowId: flowName }]
    }
    problems.push({ ...place, rule: 'flow-step', message: `業務フローの段「${kind}」は operate・outside・occur・elapse・nest のどれかにする` })
    return []
  })
}

function readFlows(reader: SourceReader, scenarios: readonly ScenarioDraft[], problems: ModelProblem[]): FlowNode[] {
  const files = reader.list(flowRoot, (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  const definitions = files.flatMap((file) => listExportedCalls(reader.read(file), 'defineFlow').map((definition) => ({ ...definition, file })))
  const flowNames = new Map(definitions.map((definition) => [`${definition.file}#${definition.name}`, readString(definition.call.arguments[0]) ?? definition.name]))
  const scenarioByPlace = new Map(scenarios.map((scenario) => [`${scenario.file}#${scenario.variable}`, scenario]))
  const flows = definitions.flatMap(({ name: variable, call, file }) => {
    const parsed = reader.read(file)
    const place = { file, line: lineOf(parsed, call) }
    const name = readString(call.arguments[0]) ?? variable
    if (name !== variable) {
      problems.push({ ...place, rule: 'flow-name', message: `業務フローの名前「${name}」を変数の名前「${variable}」と同じにする` })
    }
    checkName(problems, place, 'flow-name', name, false)
    const options = call.arguments[1]
    if (options === undefined || !ts.isObjectLiteralExpression(options)) {
      return []
    }
    const precondition = readProperty(options, 'precondition')
    const stepsNode = readProperty(options, 'steps')
    const constants = topLevelConstants(parsed)
    // 業務フローは apps/web/flow/<領域>/ に置く。領域はフォルダの名前（単語帳の名詞）。
    const folders = file.slice(flowRoot.length + 1).split('/')
    const area = folders.length === 2 ? (folders[0] ?? '') : ''
    if (area === '') {
      problems.push({ ...place, rule: 'flow-place', message: `業務フロー「${name}」を、${flowRoot}/<領域>/ のフォルダに置く` })
    } else {
      checkName(problems, place, 'flow-place', area, false)
    }
    return [
      {
        id: name,
        title: renderNounPhrase(name, 'ja'),
        area,
        areaTitle: area === '' ? '' : renderNounPhrase(area, 'ja'),
        precondition: precondition !== undefined && ts.isObjectLiteralExpression(precondition) ? (readString(readProperty(precondition, 'summary')) ?? null) : null,
        steps:
          stepsNode !== undefined && ts.isArrayLiteralExpression(stepsNode)
            ? readFlowSteps(parsed, stepsNode.elements, '', constants, scenarioByPlace, flowNames, problems)
            : [],
        parentIds: [] as string[],
        ...place,
      },
    ]
  })
  // 子フローの親と、入れ子の輪を調べる。
  const children = new Map(flows.map((flow) => [flow.id, flow.steps.flatMap((step) => (step.flowId === null ? [] : [step.flowId]))]))
  const reaches = (from: string, target: string, seen = new Set<string>()): boolean =>
    (children.get(from) ?? []).some((child) => child === target || (!seen.has(child) && (seen.add(child), reaches(child, target, seen))))
  for (const flow of flows) {
    if (reaches(flow.id, flow.id)) {
      problems.push({ file: flow.file, line: flow.line, rule: 'flow-cycle', message: `業務フロー「${flow.id}」が、子フローを通って自分を含んでいる` })
    }
  }
  return flows.map((flow) => ({ ...flow, parentIds: flows.filter((parent) => children.get(parent.id)?.includes(flow.id) === true).map((parent) => parent.id) }))
}

/** apps/web の画面のテストは、scenario（シナリオのケース）と flow（業務フローの E2E）、e2e（同じ業務フローを実ブラウザで流す）にだけ置く。 */
function checkTestPlaces(reader: SourceReader, problems: ModelProblem[]): void {
  for (const file of reader.list('apps/web', (path) => /\.test\.tsx?$/.test(path))) {
    if (!file.startsWith(`${scenarioRoot}/`) && !file.startsWith(`${flowRoot}/`) && !file.startsWith('apps/web/e2e/')) {
      problems.push({ file, line: 1, rule: 'test-place', message: '画面のテストは apps/web/scenario のシナリオのケースか、apps/web/flow の業務フローに書く（apps/web/e2e は同じ業務フローを実ブラウザで流すだけ）' })
    }
  }
}

export function readFlowModel(reader: SourceReader): FlowModelDraft {
  const problems: ModelProblem[] = []
  const scenarios = readScenarios(reader, problems)
  const cases = readCases(reader, scenarios, problems)
  const flows = readFlows(reader, scenarios, problems)
  checkTestPlaces(reader, problems)
  return { scenarios, cases, flows, problems }
}

