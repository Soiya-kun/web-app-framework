// 業務フロー・シナリオ・ケース・段の値・現行の業務フローと旧システムのテーブルを読む（apps/web/flow・scenario・step・legacy）。
// 書き方の規則に合わないところは problems に出す。
import { findUnknownTokens, startsWithVerb } from '@app/vocabulary'
import ts from 'typescript'
import { prepareLanguage, type Language } from '../language'
import { prepareScreenText, type ScreenText } from './screenText'
import { collectCalls, lineOf, listExportedCalls, readProperty, readString, unwrap, type ParsedSource, type SourceReader } from './source'
import type { CaseNode, FlowExtensionNode, FlowNode, FlowStepNode, LegacyColumnNode, LegacyTableNode, ModelInput, ModelProblem, ReplacementNode, RoleNode } from './types'

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

export const roleRoot = 'apps/web/role'
export const stepRoot = 'apps/web/step'
export const legacyRoot = 'apps/web/legacy'

/** apps/web/step に書いた、システムの外の業務・外のイベントの値。 */
export type StepDraft = {
  /** 「ファイル#変数の名前」。 */
  readonly key: string
  readonly kind: 'outside' | 'occur'
  readonly name: string
  readonly actor: string
  readonly file: string
  readonly line: number
}

export type FlowModelDraft = {
  readonly roles: RoleNode[]
  readonly scenarios: ScenarioDraft[]
  readonly cases: Map<string, { testFile: string; cases: CaseNode[] }>
  readonly flows: FlowNode[]
  readonly steps: StepDraft[]
  /** 現行の業務フロー（置き換え先の新しい業務フローの id 付き）と、旧システムのテーブル。 */
  readonly legacyFlows: (FlowNode & { readonly replacementIds: string[] })[]
  readonly legacyTables: LegacyTableNode[]
  readonly problems: ModelProblem[]
}

/** 業務フローの段を読むときに使う表。mode が legacy なら、現行の業務フローの段として読む。 */
type StepContext = {
  readonly screen: ScreenText
  readonly mode: 'flow' | 'legacy'
  readonly scenarios: ReadonlyMap<string, ScenarioDraft>
  /** 新しい業務フロー・現行の業務フローの「ファイル#変数の名前」→ 名前。 */
  readonly flowNames: ReadonlyMap<string, string>
  readonly legacyFlowNames: ReadonlyMap<string, string>
  readonly steps: ReadonlyMap<string, StepDraft>
  /** 旧システムのテーブルの「ファイル#変数の名前」→ id。 */
  readonly tables: ReadonlyMap<string, string>
  readonly roles: RoleTable
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

type RoleTable = ReadonlyMap<string, RoleNode>

/** apps/web/role の defineRole（名前・立場）を読む。 */
function readRoles(screen: ScreenText, reader: SourceReader, problems: ModelProblem[]): RoleNode[] {
  return reader
    .list(roleRoot, (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .flatMap((file) => {
      const parsed = reader.read(file)
      return listExportedCalls(parsed, 'defineRole').flatMap(({ name: variable, call }) => {
        const place = { file, line: lineOf(parsed, call) }
        const name = readString(call.arguments[0]) ?? variable
        if (name !== variable) {
          problems.push({ ...place, rule: 'role', message: `役割の名前「${name}」を変数の名前「${variable}」と同じにする` })
        }
        checkName(problems, place, 'role', name, false)
        const options = call.arguments[1]
        const side = options !== undefined && ts.isObjectLiteralExpression(options) ? readString(readProperty(options, 'side')) : undefined
        if (side !== 'vendor' && side !== 'business' && side !== 'external') {
          problems.push({ ...place, rule: 'role', message: `役割「${name}」の立場（side）は vendor・business・external のどれかにする` })
          return []
        }
        return [{ id: name, variable, title: screen.language.noun(name), side, sideTitle: screen.language.noun(side), ...place }]
      })
    })
}

/** import した役割の値から、役割を引く。 */
function resolveRole(parsed: ParsedSource, node: ts.Expression | undefined, roles: RoleTable): RoleNode | undefined {
  const inner = node === undefined ? undefined : unwrap(node)
  if (inner === undefined || !ts.isIdentifier(inner)) {
    return undefined
  }
  const imported = parsed.imports.get(inner.text)
  return imported === undefined ? undefined : roles.get(`${imported.file}#${imported.name}`)
}

/** 手順の最初の文が、画面を開く操作（await screen.go(…)）か。 */
function startsWithGo(body: ts.ConciseBody): boolean {
  const [first] = ts.isBlock(body) ? body.statements : []
  const expression = first !== undefined && ts.isExpressionStatement(first) ? unwrap(first.expression) : undefined
  return expression !== undefined && ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === 'go'
}

function readScenarios(screen: ScreenText, reader: SourceReader, roles: RoleTable, problems: ModelProblem[]): ScenarioDraft[] {
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
      const actorRole = resolveRole(parsed, readProperty(options, 'actor'), roles)
      if (actorRole === undefined) {
        problems.push({ ...place, rule: 'actor', message: `シナリオ「${name}」の担当（actor）は、${roleRoot} の defineRole の役割を import して渡す` })
      }
      const actor = actorRole?.id ?? ''
      const operate = functionBodyOf(readProperty(options, 'operate'))
      const confirm = functionBodyOf(readProperty(options, 'confirm'))
      const operateSteps = operate === null ? { steps: [], flat: true } : screen.translateScreenBody(operate.body)
      const confirmSteps = confirm === null ? { steps: [], flat: true } : screen.translateScreenBody(confirm.body)
      if (!operateSteps.flat || !confirmSteps.flat) {
        problems.push({ ...place, rule: 'scenario-flat', message: `シナリオ「${name}」の operate・confirm は、画面の操作（await screen.…）を並べるだけにする` })
      }
      if (operate !== null && !startsWithGo(operate.body)) {
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
                  handling: handling === null ? null : screen.translateScreenBody(handling.body).steps,
                },
              ]
            })
          : []
      return [
        {
          id: name,
          variable,
          title: screen.translateName(name),
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
function readRows(screen: ScreenText, node: ts.Expression | undefined): Record<string, string>[] {
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
            return [[screen.labelOf('message'), screen.messageText(literal)]]
          }
          return [[screen.labelOf(property.name.text), literal === '' ? screen.language.sentence.empty : (literal ?? value.getText())]]
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
function describeChanges(screen: ScreenText, node: ts.Expression | undefined, constants: ReadonlyMap<string, ts.Expression>): string[] {
  const inner = node === undefined ? undefined : unwrap(node)
  const resolved = inner !== undefined && ts.isIdentifier(inner) ? constants.get(inner.text) : inner
  const object = resolved === undefined ? undefined : unwrap(resolved)
  if (object === undefined || !ts.isObjectLiteralExpression(object) || !object.properties.some(ts.isSpreadAssignment)) {
    return []
  }
  return object.properties.flatMap((property) => {
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
      return [screen.language.sentence.change(screen.labelOf(property.name.text), screen.valueOf(property.initializer, constants))]
    }
    if (ts.isShorthandPropertyAssignment(property)) {
      return [screen.language.sentence.change(screen.labelOf(property.name.text), screen.language.sentence.slot(screen.labelOf(property.name.text)))]
    }
    return []
  })
}

/** ケースの中身を日本語の手順にする。同じファイルの補助の関数は、引数を置き換えて中身を展開する。 */
function translateCaseBody(
  screen: ScreenText,
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
        return translateCaseBody(screen, helper.body, helpers, bound, scenarioTitles, depth + 1)
      }
      if (callee.text === 'launchApp') {
        const [seed] = expression.arguments
        const tables = [
          ...new Set(
            flattenObject(seed, constants).flatMap((property) =>
              (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && ts.isIdentifier(property.name) ? [screen.labelOf(property.name.text)] : [],
            ),
          ),
        ]
        return [screen.language.sentence.launch(tables)]
      }
      if (callee.text === 'operateScenario') {
        const [scenario, , input] = expression.arguments
        const title = scenario !== undefined && ts.isIdentifier(scenario) ? (scenarioTitles.get(scenario.text) ?? scenario.text) : ''
        const changes = describeChanges(screen, input, constants)
        return [screen.language.sentence.operateWith(title, changes)]
      }
      if (callee.text === 'confirmScenario') {
        return [screen.language.sentence.confirmGuarantee]
      }
      if (callee.text === 'confirmExtension') {
        return [screen.language.sentence.confirmExtension]
      }
    }
    const screenStep = screen.translateScreenCall(expression, constants)
    if (screenStep !== undefined) {
      return [screenStep]
    }
    const expectCall = collectCalls(expression).find((call) => ts.isIdentifier(call.expression) && call.expression.text === 'expect')
    if (expectCall !== undefined) {
      const subject = expectCall.arguments[0]?.getText() ?? ''
      const table = /database\.(\w+)/.exec(subject)?.[1]
      const isEmpty = /\.toEqual\(\[\]\)$/.test(expression.getText())
      if (table !== undefined) {
        return [screen.language.sentence.expectTable(screen.labelOf(table), isEmpty)]
      }
      const subjectCall = expectCall.arguments[0] === undefined ? undefined : unwrap(expectCall.arguments[0])
      if (subjectCall !== undefined && ts.isCallExpression(subjectCall) && ts.isIdentifier(subjectCall.expression) && startsWithVerb(subjectCall.expression.text)) {
        const [, ...rest] = subjectCall.expression.text.split(/(?=[A-Z])/)
        const noun = rest.join('')
        return [screen.language.sentence.expectSubject(screen.language.noun(noun.charAt(0).toLowerCase() + noun.slice(1)))]
      }
      return [screen.language.sentence.expectSubject(`\`${subject}\``)]
    }
    return [`\`${statement.getText().replace(/\s+/g, ' ')}\``]
  })
}

function readCases(screen: ScreenText, reader: SourceReader, scenarios: readonly ScenarioDraft[], problems: ModelProblem[]): Map<string, { testFile: string; cases: CaseNode[] }> {
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
          const rows = isEach ? readRows(screen, args[offset]) : []
          const title = readString(args[offset + (isEach ? 1 : 0)]) ?? ''
          const run = functionBodyOf(args[offset + (isEach ? 2 : 1)])
          cases.push({
            kind,
            extension,
            title,
            pending: run === null,
            rows,
            steps: run === null ? [] : translateCaseBody(screen, run.body, helpers, constants, scenarioTitles),
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

/** 名前（識別子）が指す、import した定義の「ファイル#名前」。 */
function importKeyOf(parsed: ParsedSource, node: ts.Expression | undefined): string | undefined {
  const inner = node === undefined ? undefined : unwrap(node)
  const imported = inner !== undefined && ts.isIdentifier(inner) ? parsed.imports.get(inner.text) : undefined
  return imported === undefined || imported.file === null ? undefined : `${imported.file}#${imported.name}`
}

/** 1つか配列で書いた値の並び。 */
function listElements(node: ts.Expression | undefined): readonly ts.Expression[] {
  const inner = node === undefined ? undefined : unwrap(node)
  return inner === undefined ? [] : ts.isArrayLiteralExpression(inner) ? inner.elements : [inner]
}

/** 置き換え先（新しい業務フローのシナリオ・apps/web/step の値・業務フロー）を読む。 */
function readReplacements(context: StepContext, parsed: ParsedSource, node: ts.Expression | undefined, place: { file: string; line: number }): ReplacementNode[] {
  return listElements(node).flatMap((element): ReplacementNode[] => {
    const key = importKeyOf(parsed, element) ?? ''
    const scenario = context.scenarios.get(key)
    if (scenario !== undefined) {
      return [{ kind: 'scenario', id: scenario.id, title: scenario.title }]
    }
    const step = context.steps.get(key)
    if (step !== undefined) {
      return [{ kind: 'step', id: step.key, title: context.screen.translateName(step.name) }]
    }
    const flowName = context.flowNames.get(key)
    if (flowName !== undefined) {
      return [{ kind: 'flow', id: flowName, title: context.screen.language.noun(flowName) }]
    }
    context.problems.push({ ...place, rule: 'legacy-step', message: '置き換え先は、新しい業務フローのシナリオ・apps/web/step の値・業務フローを import して指す' })
    return []
  })
}

function readFlowSteps(context: StepContext, parsed: ParsedSource, elements: readonly ts.Expression[], prefix: string, constants: ReadonlyMap<string, ts.Expression>): FlowStepNode[] {
  const { screen, problems, mode } = context
  const extensionLetters = 'abcdefghijklmnopqrstuvwxyz'
  const stepCalls = mode === 'flow' ? 'operate・outside・occur・elapse・nest' : 'operateLegacy・outside・occur・elapse・nest'
  return elements.flatMap((element, index): FlowStepNode[] => {
    const call = unwrap(element)
    const number = `${prefix}${index + 1}`
    const place = { file: parsed.file, line: lineOf(parsed, element) }
    const base = { number, actor: null, actorTitle: null, scenarioId: null, flowId: null, inputs: [], extensions: [], stepKey: null, replacements: [], tableIds: [], change: null, screenSteps: [], guarantee: [], ...place }
    // apps/web/step の値（システムの外の業務・外のイベント）。
    if (ts.isIdentifier(call)) {
      const step = context.steps.get(importKeyOf(parsed, call) ?? '')
      if (step === undefined) {
        problems.push({ ...place, rule: 'flow-step', message: `業務フローの段は ${stepCalls} の呼び出しか、${stepRoot} の値にする` })
        return []
      }
      return [{ ...base, kind: step.kind, title: screen.translateName(step.name), actor: step.actor, actorTitle: screen.language.noun(step.actor), stepKey: step.key }]
    }
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) {
      problems.push({ ...place, rule: 'flow-step', message: `業務フローの段は ${stepCalls} の呼び出しか、${stepRoot} の値にする` })
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
      return resolved !== undefined && ts.isObjectLiteralExpression(unwrap(resolved)) ? screen.readInputs(unwrap(resolved) as ts.ObjectLiteralExpression, constants) : []
    }
    const optionOf = (node: ts.Expression | undefined, name: string): ts.Expression | undefined => {
      const inner = node === undefined ? undefined : unwrap(node)
      return inner !== undefined && ts.isObjectLiteralExpression(inner) ? readProperty(inner, name) : undefined
    }
    if (kind === 'operate') {
      if (mode === 'legacy') {
        problems.push({ ...place, rule: 'legacy-step', message: '現行の業務フローに画面の操作（operate）は書かない。旧システムの操作は operateLegacy で書く' })
        return []
      }
      const scenario = context.scenarios.get(importKeyOf(parsed, first) ?? '')
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
                  then: thenNode !== undefined && ts.isArrayLiteralExpression(thenNode) ? readFlowSteps(context, parsed, thenNode.elements, `${key}.`, constants) : [],
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
          actorTitle: screen.language.noun(scenario.actor),
          scenarioId: scenario.id,
          inputs: inputsOf(second),
          extensions,
        },
      ]
    }
    if (kind === 'outside' || kind === 'occur' || kind === 'operateLegacy') {
      const actorRole = resolveRole(parsed, first, context.roles)
      if (actorRole === undefined) {
        problems.push({ ...place, rule: 'step-name', message: `段「${kind}」の担当は、${roleRoot} の defineRole の役割を import して渡す` })
      }
      const actor = actorRole?.id ?? ''
      const name = readString(second) ?? ''
      checkName(problems, place, 'step-name', name, true)
      const stepKind = kind === 'operateLegacy' ? 'legacy' : kind
      if (mode === 'flow') {
        problems.push(
          kind === 'operateLegacy'
            ? { ...place, rule: 'flow-step', message: '旧システムの操作（operateLegacy）は、現行の業務フロー（apps/web/legacy）にだけ書く' }
            : { ...place, rule: 'step-place', message: `システムの外の業務・外のイベントは、${stepRoot} に書いた値を使う（現行の業務フローと同じ段か分かるように）` },
        )
      }
      const shared = [...context.steps.values()].find((step) => step.kind === stepKind && step.name === name && step.actor === actor)
      if (mode === 'legacy' && shared !== undefined) {
        problems.push({ ...place, rule: 'legacy-step', message: `変わらない業務なら、${stepRoot} の値（${name}）を使う` })
      }
      const replacements = mode === 'legacy' ? readReplacements(context, parsed, optionOf(third, 'replacement'), place) : []
      const tableIds =
        kind === 'operateLegacy'
          ? listElements(optionOf(third, 'tables')).flatMap((node) => {
              const table = context.tables.get(importKeyOf(parsed, node) ?? '')
              if (table === undefined) {
                problems.push({ ...place, rule: 'legacy-step', message: '旧システムの操作のテーブルは、defineLegacyTable の値を import して渡す' })
              }
              return table === undefined ? [] : [table]
            })
          : []
      // 旧システムの画面の手順（書いたときだけ）。画面の操作を並べるだけにする。
      const procedureOf = (option: string): string[] => {
        const body = kind === 'operateLegacy' ? functionBodyOf(optionOf(third, option)) : null
        if (body === null) {
          return []
        }
        const translated = screen.translateScreenBody(body.body, constants, true)
        if (!translated.flat) {
          problems.push({ ...place, rule: 'legacy-step', message: `旧システムの画面の手順（${option}）は、画面の操作（await screen.…）を並べるだけにする` })
        }
        return translated.steps
      }
      return [
        {
          ...base,
          kind: stepKind,
          title: screen.translateName(name),
          actor,
          actorTitle: screen.language.noun(actor),
          replacements,
          tableIds,
          screenSteps: procedureOf('operate'),
          guarantee: procedureOf('confirm'),
        },
      ]
    }
    if (kind === 'elapse') {
      const time = readString(first) ?? ''
      const date = readString(second) ?? ''
      checkName(problems, place, 'elapse', time, false)
      if (mode === 'flow' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        problems.push({ ...place, rule: 'elapse', message: `時の経過の日付「${date}」は YYYY-MM-DD にする` })
      }
      return [{ ...base, kind, title: screen.language.sentence.elapse(screen.labelOf(time), mode === 'flow' ? date : ''), stepKey: `elapse:${time}` }]
    }
    if (kind === 'nest') {
      const flowName = (mode === 'flow' ? context.flowNames : context.legacyFlowNames).get(importKeyOf(parsed, first) ?? '')
      if (flowName === undefined) {
        problems.push({ ...place, rule: 'flow-step', message: mode === 'flow' ? 'nest には、apps/web/flow の defineFlow を渡す' : 'nest には、apps/web/legacy の defineLegacyFlow を渡す' })
        return []
      }
      return [{ ...base, kind, title: screen.language.noun(flowName), flowId: flowName }]
    }
    problems.push({ ...place, rule: 'flow-step', message: `業務フローの段「${kind}」は ${stepCalls} のどれかにする` })
    return []
  })
}

/** apps/web/step の値（outside・occur）を読む。変数の名前は段の名前と同じにする。 */
function readSteps(screen: ScreenText, reader: SourceReader, roles: RoleTable, problems: ModelProblem[]): StepDraft[] {
  return reader
    .list(stepRoot, (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .flatMap((file) => {
      const parsed = reader.read(file)
      return (['outside', 'occur'] as const).flatMap((kind) =>
        listExportedCalls(parsed, kind).map(({ name: variable, call }) => {
          const place = { file, line: lineOf(parsed, call) }
          const name = readString(call.arguments[1]) ?? variable
          if (name !== variable) {
            problems.push({ ...place, rule: 'step-name', message: `段の名前「${name}」を変数の名前「${variable}」と同じにする` })
          }
          checkName(problems, place, 'step-name', name, true)
          if (call.arguments[2] !== undefined) {
            problems.push({ ...place, rule: 'step-place', message: `${stepRoot} の値に置き換え先は書かない（現行の業務フローの段にだけ書く）` })
          }
          const role = resolveRole(parsed, call.arguments[0], roles)
          if (role === undefined) {
            problems.push({ ...place, rule: 'step-name', message: `段「${name}」の担当は、${roleRoot} の defineRole の役割を import して渡す` })
          }
          return { key: `${file}#${variable}`, kind, name, actor: role?.id ?? '', ...place }
        }),
      )
    })
}

/** 旧システムのテーブル（apps/web/legacy の defineLegacyTable）を読む。 */
function readLegacyTables(reader: SourceReader, problems: ModelProblem[]): LegacyTableNode[] {
  return reader
    .list(legacyRoot, (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .flatMap((file) => {
      const parsed = reader.read(file)
      return listExportedCalls(parsed, 'defineLegacyTable').map(({ name: variable, call }) => {
        const place = { file, line: lineOf(parsed, call) }
        checkName(problems, place, 'legacy-table', variable, false)
        const options = call.arguments[1]
        const option = (name: string) => (options !== undefined && ts.isObjectLiteralExpression(options) ? readProperty(options, name) : undefined)
        const columns = listElements(option('columns')).flatMap((node): LegacyColumnNode[] => {
          const column = unwrap(node)
          if (!ts.isObjectLiteralExpression(column)) {
            return []
          }
          const text = (name: string) => readString(readProperty(column, name)) ?? ''
          const [tableId, columnName] = text('replacement').split('.')
          return [
            {
              name: text('name'),
              title: text('title'),
              type: text('type'),
              note: text('note'),
              replacement: tableId === undefined || tableId === '' || columnName === undefined ? null : { tableId, column: columnName },
            },
          ]
        })
        return {
          id: variable,
          name: readString(call.arguments[0]) ?? variable,
          title: readString(option('title')) ?? variable,
          note: readString(option('note')) ?? '',
          columns,
          ...place,
        }
      })
    })
}

type FlowDefinition = { readonly name: string; readonly call: ts.CallExpression; readonly file: string }

function listFlowDefinitions(reader: SourceReader, root: string, calleeName: string): FlowDefinition[] {
  return reader
    .list(root, (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .flatMap((file) => listExportedCalls(reader.read(file), calleeName).map((definition) => ({ ...definition, file })))
}

/** 業務フロー（mode が legacy なら現行の業務フロー）を読む。置き場所は <root>/<領域>/<名前>.ts。 */
function readFlowNodes(context: StepContext, reader: SourceReader, definitions: readonly FlowDefinition[]): (FlowNode & { readonly replacementIds: string[] })[] {
  const { screen, problems, mode } = context
  const root = mode === 'flow' ? flowRoot : legacyRoot
  const nameRule = mode === 'flow' ? 'flow-name' : 'legacy-name'
  const placeRule = mode === 'flow' ? 'flow-place' : 'legacy-place'
  const subject = mode === 'flow' ? '業務フロー' : '現行の業務フロー'
  const flows = definitions.flatMap(({ name: variable, call, file }) => {
    const parsed = reader.read(file)
    const place = { file, line: lineOf(parsed, call) }
    const name = readString(call.arguments[0]) ?? variable
    if (name !== variable) {
      problems.push({ ...place, rule: nameRule, message: `${subject}の名前「${name}」を変数の名前「${variable}」と同じにする` })
    }
    checkName(problems, place, nameRule, name, false)
    if (mode === 'legacy' && !/^legacy[A-Z]/.test(name)) {
      problems.push({ ...place, rule: nameRule, message: `現行の業務フローの名前「${name}」は legacy で始める（新しい業務フローと名前を分ける）` })
    }
    const options = call.arguments[1]
    if (options === undefined || !ts.isObjectLiteralExpression(options)) {
      return []
    }
    const precondition = readProperty(options, 'precondition')
    const stepsNode = readProperty(options, 'steps')
    const constants = topLevelConstants(parsed)
    // <root>/<領域>/ に置く。領域はフォルダの名前（単語帳の名詞）。
    const folders = file.slice(root.length + 1).split('/')
    const area = folders.length === 2 ? (folders[0] ?? '') : ''
    if (area === '') {
      problems.push({ ...place, rule: placeRule, message: `${subject}「${name}」を、${root}/<領域>/ のフォルダに置く` })
    } else {
      checkName(problems, place, placeRule, area, false)
    }
    const replacementIds =
      mode === 'legacy'
        ? listElements(readProperty(options, 'replacement')).flatMap((node) => {
            const flowName = context.flowNames.get(importKeyOf(parsed, node) ?? '')
            if (flowName === undefined) {
              problems.push({ ...place, rule: 'legacy-step', message: '現行の業務フローの置き換え先は、apps/web/flow の defineFlow を import して指す' })
            }
            return flowName === undefined ? [] : [flowName]
          })
        : []
    return [
      {
        id: name,
        title: screen.language.noun(name),
        area,
        areaTitle: area === '' ? '' : screen.language.noun(area),
        precondition: precondition !== undefined && ts.isObjectLiteralExpression(precondition) ? (readString(readProperty(precondition, 'summary')) ?? null) : null,
        steps: stepsNode !== undefined && ts.isArrayLiteralExpression(stepsNode) ? readFlowSteps(context, parsed, stepsNode.elements, '', constants) : [],
        parentIds: [] as string[],
        legacyIds: [] as string[],
        replacementIds,
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
      problems.push({ file: flow.file, line: flow.line, rule: 'flow-cycle', message: `${subject}「${flow.id}」が、子フローを通って自分を含んでいる` })
    }
  }
  return flows.map((flow) => ({ ...flow, parentIds: flows.filter((parent) => children.get(parent.id)?.includes(flow.id) === true).map((parent) => parent.id) }))
}

/**
 * apps/web の画面のテストは、scenario（シナリオのケース）と flow（業務フローの E2E）、transition（画面遷移）、e2e（同じ業務フローを実ブラウザで流す）、
 * mock（同じ業務フローをモックの開発パネルで流す道具のテスト）にだけ置く。
 */
function checkTestPlaces(reader: SourceReader, problems: ModelProblem[]): void {
  const toolRoots = ['apps/web/e2e/', 'apps/web/mock/']
  for (const file of reader.list('apps/web', (path) => /\.test\.tsx?$/.test(path))) {
    if (!file.startsWith(`${scenarioRoot}/`) && !file.startsWith(`${flowRoot}/`) && !file.startsWith('apps/web/transition/') && !toolRoots.some((root) => file.startsWith(root))) {
      problems.push({
        file,
        line: 1,
        rule: 'test-place',
        message: '画面のテストは apps/web/scenario のシナリオのケースか、apps/web/flow の業務フロー、apps/web/transition の画面遷移に書く（apps/web/e2e・apps/web/mock は同じ業務フローを実ブラウザ・モックで流す道具）',
      })
    }
  }
}

export function readFlowModel(reader: SourceReader, language: Language = prepareLanguage('ja')): FlowModelDraft {
  const screen = prepareScreenText(language)
  const problems: ModelProblem[] = []
  const roles = readRoles(screen, reader, problems)
  const roleTable = new Map(roles.map((role) => [`${role.file}#${role.variable}`, role]))
  const scenarios = readScenarios(screen, reader, roleTable, problems)
  const cases = readCases(screen, reader, scenarios, problems)
  const steps = readSteps(screen, reader, roleTable, problems)
  const legacyTables = readLegacyTables(reader, problems)
  const flowDefinitions = listFlowDefinitions(reader, flowRoot, 'defineFlow')
  const legacyDefinitions = listFlowDefinitions(reader, legacyRoot, 'defineLegacyFlow')
  const nameTable = (definitions: readonly FlowDefinition[]) =>
    new Map(definitions.map((definition) => [`${definition.file}#${definition.name}`, readString(definition.call.arguments[0]) ?? definition.name]))
  const context = {
    screen,
    scenarios: new Map(scenarios.map((scenario) => [`${scenario.file}#${scenario.variable}`, scenario])),
    flowNames: nameTable(flowDefinitions),
    legacyFlowNames: nameTable(legacyDefinitions),
    steps: new Map(steps.map((step) => [step.key, step])),
    tables: new Map(legacyTables.map((table) => [`${table.file}#${table.id}`, table.id])),
    roles: roleTable,
    problems,
  }
  // 置き換え先は現行の業務フローだけが持つ。
  const flows = readFlowNodes({ ...context, mode: 'flow' }, reader, flowDefinitions).map((flow) => Object.fromEntries(Object.entries(flow).filter(([key]) => key !== 'replacementIds')) as FlowNode)
  const legacyFlows = readFlowNodes({ ...context, mode: 'legacy' }, reader, legacyDefinitions)
  checkTestPlaces(reader, problems)
  return { roles, scenarios, cases, flows, steps, legacyFlows, legacyTables, problems }
}

