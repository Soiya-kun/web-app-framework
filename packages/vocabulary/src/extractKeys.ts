// 画面のコードから、使っている見出し・ボタンのキーを集める（i18n の抽出と同じ考え方）。
// text.label('…')・text.action('…')・labelKey('…')・actionKey('…') の、文字列リテラルの引数を集める。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

export type ExtractedKeys = {
  readonly labels: ReadonlyMap<string, readonly string[]>
  readonly actions: ReadonlyMap<string, readonly string[]>
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory)
    .sort()
    .flatMap((entry) => {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) {
        return entry === 'node_modules' || entry === 'generated' ? [] : listSourceFiles(path)
      }
      return /\.tsx?$/.test(path) ? [path] : []
    })
}

export function extractCatalogKeys(repositoryRoot: string, sourceDirectories: readonly string[]): ExtractedKeys {
  const labels = new Map<string, string[]>()
  const actions = new Map<string, string[]>()

  function record(target: Map<string, string[]>, key: string, location: string): void {
    target.set(key, [...(target.get(key) ?? []), location])
  }

  for (const directory of sourceDirectories) {
    for (const path of listSourceFiles(join(repositoryRoot, directory))) {
      const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const [first] = node.arguments
          const callee = node.expression
          const calleeName = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : ''
          const isLiteral = first !== undefined && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
          if (isLiteral) {
            const location = `${relative(repositoryRoot, path)}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}`
            if (calleeName === 'labelKey' || (ts.isPropertyAccessExpression(callee) && calleeName === 'label')) {
              record(labels, first.text, location)
            }
            if (calleeName === 'actionKey' || (ts.isPropertyAccessExpression(callee) && calleeName === 'action')) {
              record(actions, first.text, location)
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
    }
  }
  return { labels, actions }
}
