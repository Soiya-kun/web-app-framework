// 静的解析の共通の道具。ファイルの一覧・構文木の読み込み・import の解決・リテラルの読み取り。型の解決はしない（速さのため）。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import ts from 'typescript'

export type ImportedName = { readonly file: string | null; readonly specifier: string; readonly name: string }

export type ParsedSource = {
  readonly file: string
  readonly source: ts.SourceFile
  /** 読み込んだ名前（別名を含む）→ どのファイルのどの名前か。 */
  readonly imports: ReadonlyMap<string, ImportedName>
}

export type SourceReader = {
  readonly root: string
  read(file: string): ParsedSource
  list(directory: string, accept: (file: string) => boolean): string[]
  exists(file: string): boolean
  text(file: string): string
}

export function prepareSourceReader(root: string): SourceReader {
  const cache = new Map<string, ParsedSource>()

  function resolveImport(from: string, specifier: string): string | null {
    if (!specifier.startsWith('.')) {
      return null
    }
    const base = normalize(join(dirname(from), specifier))
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
      const path = join(root, candidate)
      if (existsSync(path) && statSync(path).isFile()) {
        return candidate
      }
    }
    return null
  }

  return {
    root,
    read(file) {
      const cached = cache.get(file)
      if (cached !== undefined) {
        return cached
      }
      const source = ts.createSourceFile(file, readFileSync(join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      const imports = new Map<string, ImportedName>()
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
          continue
        }
        const specifier = statement.moduleSpecifier.text
        const resolved = resolveImport(file, specifier)
        const bindings = statement.importClause?.namedBindings
        if (bindings !== undefined && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            imports.set(element.name.text, { file: resolved, specifier, name: (element.propertyName ?? element.name).text })
          }
        }
      }
      const parsed = { file, source, imports }
      cache.set(file, parsed)
      return parsed
    },
    list(directory, accept) {
      const walk = (relativeDirectory: string): string[] => {
        const absolute = join(root, relativeDirectory)
        if (!existsSync(absolute)) {
          return []
        }
        return readdirSync(absolute)
          .sort()
          .flatMap((entry) => {
            const file = join(relativeDirectory, entry)
            if (statSync(join(root, file)).isDirectory()) {
              return entry === 'node_modules' || entry === 'generated' ? [] : walk(file)
            }
            return accept(file) ? [file] : []
          })
      }
      return walk(directory)
    },
    exists(file) {
      return existsSync(join(root, file))
    },
    text(file) {
      return readFileSync(join(root, file), 'utf8')
    },
  }
}

export function lineOf(parsed: ParsedSource, node: ts.Node): number {
  return parsed.source.getLineAndCharacterOfPosition(node.getStart(parsed.source)).line + 1
}

export function readString(node: ts.Node | undefined): string | undefined {
  if (node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
    return node.text
  }
  return undefined
}

export function unwrap(expression: ts.Expression): ts.Expression {
  if (
    ts.isAwaitExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return unwrap(expression.expression)
  }
  return expression
}

/** TSDoc の1行目（目的）。 */
export function readPurpose(node: ts.Node): string {
  const [document] = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc)
  return ts.getTextOfJSDocComment(document?.comment) ?? ''
}

export function isExported(statement: ts.Statement): boolean {
  return ts.canHaveModifiers(statement) && (ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
}

/** export const name = call(...) の形を集める。 */
export function listExportedCalls(parsed: ParsedSource, calleeName: string): { readonly name: string; readonly call: ts.CallExpression; readonly statement: ts.VariableStatement }[] {
  return parsed.source.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement) || !isExported(statement)) {
      return []
    }
    return statement.declarationList.declarations.flatMap((declaration) => {
      const initializer = declaration.initializer === undefined ? undefined : unwrap(declaration.initializer)
      if (
        ts.isIdentifier(declaration.name) &&
        initializer !== undefined &&
        ts.isCallExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        initializer.expression.text === calleeName
      ) {
        return [{ name: declaration.name.text, call: initializer, statement }]
      }
      return []
    })
  })
}

export function readProperty(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === name) {
      return property.initializer
    }
    if (ts.isMethodDeclaration(property) && ts.isIdentifier(property.name) && property.name.text === name) {
      return undefined
    }
  }
  return undefined
}

/** ノードの中の呼び出しを、深さ優先で集める。 */
export function collectCalls(node: ts.Node): ts.CallExpression[] {
  const calls: ts.CallExpression[] = []
  const visit = (child: ts.Node): void => {
    if (ts.isCallExpression(child)) {
      calls.push(child)
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return calls
}

/** ノードの中の識別子の名前。 */
export function collectIdentifiers(node: ts.Node): Set<string> {
  const names = new Set<string>()
  const visit = (child: ts.Node): void => {
    if (ts.isIdentifier(child)) {
      names.add(child.text)
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return names
}

export function relativeTo(root: string, path: string): string {
  return relative(root, path)
}
