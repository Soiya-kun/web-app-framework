// バックエンドを読む。API の入口（Hono のルート）→ usecase（処理）→ domain の関数（規則）・repository の呼び出し → SQL → テーブル。
import { prepareLanguage, type Language } from '../language'
import ts from 'typescript'
import { translateSource, type StepTranslation } from '../translateSource'
import { collectCalls, collectIdentifiers, isExported, lineOf, readString, type ParsedSource, type SourceReader } from './source'
import type { ColumnNode, EndpointNode, RepositoryCallNode, RuleNode, StatementNode, TableNode, WorkNode } from './types'

const backendRoot = 'packages/backend/src'
const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete'])

export type BackendModel = {
  readonly endpoints: EndpointNode[]
  readonly works: WorkNode[]
  readonly rules: RuleNode[]
  readonly statements: StatementNode[]
  readonly tables: TableNode[]
}

function toCamel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function joinPath(...segments: string[]): string {
  const path = segments.join('/').replace(/\/+/g, '/').replace(/\/$/, '')
  return path === '' ? '/' : path
}

/** app.ts の basePath と route('/payments', preparePaymentHandler(…)) から、handler の関数 → 道筋の頭。 */
function readRoutePrefixes(reader: SourceReader): { basePath: string; prefixes: Map<string, { prefix: string; file: string | null }> } {
  const parsed = reader.read(`${backendRoot}/handler/app.ts`)
  let basePath = ''
  const prefixes = new Map<string, { prefix: string; file: string | null }>()
  for (const call of collectCalls(parsed.source)) {
    if (!ts.isPropertyAccessExpression(call.expression)) {
      continue
    }
    const method = call.expression.name.text
    const [first, second] = call.arguments
    if (method === 'basePath') {
      basePath = readString(first) ?? ''
    }
    if (method === 'route' && second !== undefined && ts.isCallExpression(second) && ts.isIdentifier(second.expression)) {
      const factory = second.expression.text
      prefixes.set(factory, { prefix: readString(first) ?? '', file: parsed.imports.get(factory)?.file ?? null })
    }
  }
  return { basePath, prefixes }
}

/** usecase として呼んでいる関数（../usecase/… から読み込んだもの）。 */
function listUsecaseCalls(parsed: ParsedSource, node: ts.Node): string[] {
  return [
    ...new Set(
      collectCalls(node).flatMap((call) => {
        if (!ts.isIdentifier(call.expression)) {
          return []
        }
        const imported = parsed.imports.get(call.expression.text)
        return imported?.file?.includes('/usecase/') === true ? [imported.name] : []
      }),
    ),
  ]
}

function readEndpoints(reader: SourceReader): EndpointNode[] {
  const { basePath, prefixes } = readRoutePrefixes(reader)
  const endpoints: EndpointNode[] = []
  const appFile = reader.read(`${backendRoot}/handler/app.ts`)
  const readRoutes = (parsed: ParsedSource, prefix: string) => {
    for (const call of collectCalls(parsed.source)) {
      if (!ts.isPropertyAccessExpression(call.expression) || !httpMethods.has(call.expression.name.text)) {
        continue
      }
      const path = readString(call.arguments[0])
      const handler = call.arguments.at(-1)
      if (path === undefined || handler === undefined) {
        continue
      }
      const method = call.expression.name.text.toUpperCase()
      const fullPath = joinPath(basePath, prefix, path)
      endpoints.push({
        id: `${method} ${fullPath}`,
        method,
        path: fullPath,
        workIds: listUsecaseCalls(parsed, handler),
        file: parsed.file,
        line: lineOf(parsed, call.expression.name),
      })
    }
  }
  readRoutes(appFile, '')
  for (const { prefix, file } of prefixes.values()) {
    if (file !== null) {
      readRoutes(reader.read(file), prefix)
    }
  }
  return endpoints.sort((left, right) => left.id.localeCompare(right.id))
}

function toStepNodes(steps: readonly StepTranslation[]): WorkNode['steps'] {
  return steps.map((step) => ({ text: step.text, children: toStepNodes(step.children) }))
}

/** 関数の宣言（export function・export const = アロー関数）。 */
function listExportedFunctions(parsed: ParsedSource): { readonly name: string; readonly body: ts.Node }[] {
  return parsed.source.statements.flatMap((statement) => {
    if (!isExported(statement)) {
      return []
    }
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined && statement.body !== undefined) {
      return [{ name: statement.name.text, body: statement.body }]
    }
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.flatMap((declaration) =>
        ts.isIdentifier(declaration.name) &&
        declaration.initializer !== undefined &&
        (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
          ? [{ name: declaration.name.text, body: declaration.initializer.body }]
          : [],
      )
    }
    return []
  })
}

function readRules(language: Language, reader: SourceReader): RuleNode[] {
  return reader
    .list(`${backendRoot}/domain`, (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .flatMap((file) => {
      const parsed = reader.read(file)
      return translateSource(parsed.source.getFullText(), file, language).map((translation) => ({
        id: `${file}#${translation.name}`,
        name: translation.name,
        title: translation.title,
        steps: toStepNodes(translation.steps),
        file,
        line: translation.line,
      }))
    })
}

/** repository の名前（paymentRepository）と method → 流す SQL の名前。 */
function readRepositoryStatements(reader: SourceReader, statementNames: ReadonlyMap<string, string>): Map<string, string[]> {
  const result = new Map<string, string[]>()
  const setPath = `${backendRoot}/repository/postgres/postgresDatabase.ts`
  if (!reader.exists(setPath)) {
    return result
  }
  const setFile = reader.read(setPath)
  for (const call of collectCalls(setFile.source)) {
    if (!ts.isIdentifier(call.expression) || !ts.isPropertyAssignment(call.parent) || !ts.isIdentifier(call.parent.name)) {
      continue
    }
    const repositoryName = call.parent.name.text
    const factoryFile = setFile.imports.get(call.expression.text)?.file
    if (factoryFile === null || factoryFile === undefined) {
      continue
    }
    const parsed = reader.read(factoryFile)
    const helpers = new Map<string, ts.Node>()
    for (const statement of parsed.source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name !== undefined && statement.body !== undefined && !isExported(statement)) {
        helpers.set(statement.name.text, statement.body)
      }
    }
    const statementsIn = (node: ts.Node): string[] => {
      const names = collectIdentifiers(node)
      const direct = [...names].flatMap((name) => {
        const imported = parsed.imports.get(name)
        const statementName = imported === undefined ? undefined : statementNames.get(`${imported.file}#${imported.name}`)
        return statementName === undefined ? [] : [statementName]
      })
      const throughHelpers = [...names].flatMap((name) => {
        const helper = helpers.get(name)
        return helper === undefined || helper === node ? [] : statementsIn(helper)
      })
      return [...new Set([...direct, ...throughHelpers])]
    }
    const visit = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.body !== undefined) {
        result.set(`${repositoryName}.${node.name.text}`, statementsIn(node.body))
      }
      ts.forEachChild(node, visit)
    }
    visit(parsed.source)
  }
  return result
}

function readWorks(language: Language, reader: SourceReader, rules: readonly RuleNode[], repositoryStatements: ReadonlyMap<string, string[]>, endpoints: readonly EndpointNode[]): WorkNode[] {
  const ruleIds = new Map(rules.map((rule) => [`${rule.file}#${rule.name}`, rule.id]))
  return reader
    .list(`${backendRoot}/usecase`, (file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.includes('_mock'))
    .flatMap((file) => {
      const parsed = reader.read(file)
      const translations = new Map(translateSource(parsed.source.getFullText(), file, language).map((translation) => [translation.name, translation]))
      return listExportedFunctions(parsed).flatMap(({ name, body }) => {
        const translation = translations.get(name)
        if (translation === undefined) {
          return []
        }
        const calls = collectCalls(body)
        const calledRules = calls.flatMap((call) => {
          if (!ts.isIdentifier(call.expression)) {
            return []
          }
          const imported = parsed.imports.get(call.expression.text)
          const ruleId = imported?.file === null || imported === undefined ? undefined : ruleIds.get(`${imported.file}#${imported.name}`)
          return ruleId === undefined ? [] : [ruleId]
        })
        const repositoryCalls: RepositoryCallNode[] = calls.flatMap((call) => {
          const callee = call.expression
          if (!ts.isPropertyAccessExpression(callee) || !ts.isPropertyAccessExpression(callee.expression)) {
            return []
          }
          const repository = callee.expression.name.text
          if (!repository.endsWith('Repository')) {
            return []
          }
          const method = callee.name.text
          return [{ repository, method, title: language.step(method, repository) ?? method, statementIds: repositoryStatements.get(`${repository}.${method}`) ?? [] }]
        })
        return [
          {
            id: name,
            title: translation.title,
            steps: toStepNodes(translation.steps),
            ruleIds: [...new Set(calledRules)],
            repositoryCalls,
            endpointIds: endpoints.filter((endpoint) => endpoint.workIds.includes(name)).map((endpoint) => endpoint.id),
            file,
            line: translation.line,
          },
        ]
      })
    })
}

function readStatements(reader: SourceReader): { statements: StatementNode[]; names: Map<string, string> } {
  const statements: StatementNode[] = []
  const names = new Map<string, string>()
  for (const file of reader.list(`${backendRoot}/repository/postgres`, (path) => path.endsWith('.ts'))) {
    const parsed = reader.read(file)
    for (const statement of parsed.source.statements) {
      if (!ts.isVariableStatement(statement)) {
        continue
      }
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer
        if (!ts.isIdentifier(declaration.name) || initializer === undefined || !ts.isCallExpression(initializer)) {
          continue
        }
        const [nameNode, textNode] = initializer.arguments
        const name = readString(nameNode)
        const text = readString(textNode)
        if (name === undefined || text === undefined) {
          continue
        }
        names.set(`${file}#${declaration.name.text}`, name)
        // 行のロック（FOR UPDATE OF s）と upsert（DO UPDATE SET）はテーブルではないので、先に除く。
        const tableText = text.replace(/\bFOR\s+UPDATE(?:\s+OF\s+\w+)?/gi, '').replace(/\bDO\s+UPDATE\b/gi, '')
        const tableIds = [...new Set([...tableText.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_]+)/gi)].map((match) => match[1] ?? ''))].filter(
          (table) => table !== '' && table !== 'unnest',
        )
        statements.push({ id: name, text: text.trim(), tableIds, file, line: lineOf(parsed, initializer) })
      }
    }
  }
  return { statements, names }
}

function readTables(language: Language, reader: SourceReader, statements: readonly StatementNode[]): TableNode[] {
  const tables: TableNode[] = []
  for (const file of reader.list('packages/backend/database/migration', (path) => path.endsWith('.sql'))) {
    const lines = reader.text(file).split('\n')
    let current: { id: string; line: number; note: string; columns: ColumnNode[] } | null = null
    let comments: string[] = []
    lines.forEach((rawLine, index) => {
      const commentOnly = /^\s*--\s?(.*)$/.exec(rawLine)
      if (commentOnly !== null && current === null) {
        comments.push(commentOnly[1] ?? '')
        return
      }
      const table = /^CREATE TABLE (\w+)/.exec(rawLine)
      if (table?.[1] !== undefined) {
        current = { id: table[1], line: index + 1, note: comments.join(' '), columns: [] }
        comments = []
        return
      }
      if (current !== null && /^\);/.test(rawLine.trim())) {
        const finished: { id: string; line: number; note: string; columns: ColumnNode[] } = current
        tables.push({
          id: finished.id,
          title: language.noun(toCamel(finished.id)),
          note: finished.note,
          columns: finished.columns,
          statementIds: statements.filter((statement) => statement.tableIds.includes(finished.id)).map((statement) => statement.id),
          file,
          line: finished.line,
        })
        current = null
        return
      }
      const column = /^\s+([a-z_]+)\s+(text|smallint|integer|bigint|date|boolean)\b[^-]*(?:--\s*(.*))?$/.exec(rawLine)
      if (current !== null && column?.[1] !== undefined && !['primary', 'unique', 'check', 'constraint', 'foreign'].includes(column[1])) {
        ;(current as { columns: ColumnNode[] }).columns.push({
          name: column[1],
          title: language.noun(toCamel(column[1])),
          type: column[2] ?? '',
          note: column[3] ?? '',
        })
      }
      if (commentOnly === null && current === null) {
        comments = []
      }
    })
  }
  return tables
}

export function readBackendModel(reader: SourceReader, language: Language = prepareLanguage('ja')): BackendModel {
  if (!reader.exists(`${backendRoot}/handler/app.ts`)) {
    return { endpoints: [], works: [], rules: [], statements: [], tables: [] }
  }
  const endpoints = readEndpoints(reader)
  const rules = readRules(language, reader)
  const { statements, names } = readStatements(reader)
  const repositoryStatements = readRepositoryStatements(reader, names)
  const works = readWorks(language, reader, rules, repositoryStatements, endpoints)
  const tables = readTables(language, reader, statements)
  return { endpoints, works, rules, statements, tables }
}
