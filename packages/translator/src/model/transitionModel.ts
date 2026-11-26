// 画面遷移のテスト（apps/web/transition の describeTransition）を読み、画面遷移の図のもとにする。
// 経路ごとに、開く（go）・押す（press）・たどる（follow）と、そのあと確かめた見出し（expectHeading）から、画面から画面への遷移を求める。
import ts from 'typescript'
import type { ScreenText } from './screenText'
import { lineOf, readString, unwrap, type SourceReader } from './source'
import type { ModelProblem, PageNode, TransitionEdgeNode, TransitionNode } from './types'

export const transitionRoot = 'apps/web/transition'

/** 受け手が app.screen か、その行（rowOf・row）か。 */
function isScreenCall(call: ts.CallExpression): call is ts.CallExpression & { expression: ts.PropertyAccessExpression } {
  if (!ts.isPropertyAccessExpression(call.expression)) {
    return false
  }
  const receiver = call.expression.expression.getText()
  return /(^|\.)screen(\.|$)/.test(receiver)
}

/** 関数の本体の中の、Screen の操作の呼び出し（書いた順）。 */
function listScreenCalls(body: ts.Node): (ts.CallExpression & { expression: ts.PropertyAccessExpression })[] {
  const calls: (ts.CallExpression & { expression: ts.PropertyAccessExpression })[] = []
  const visit = (node: ts.Node): void => {
    ts.forEachChild(node, visit)
    if (ts.isCallExpression(node) && isScreenCall(node) && ['go', 'press', 'follow', 'expectHeading'].includes(node.expression.name.text)) {
      calls.push(node)
    }
  }
  visit(body)
  return calls.sort((left, right) => left.getStart() - right.getStart())
}

export function readTransitions(screen: ScreenText, reader: SourceReader, pages: readonly PageNode[], navigation: ReadonlyMap<string, string>, problems: ModelProblem[]): TransitionNode[] {
  const screenByHeading = new Map(pages.flatMap((page) => (page.headingKey === null ? [] : [[page.headingKey, page.screenId] as const])))
  const screenByPath = new Map(pages.map((page) => [page.id, page.screenId]))
  return reader
    .list(transitionRoot, (file) => file.endsWith('.test.tsx'))
    .flatMap((file) => {
      const parsed = reader.read(file)
      return parsed.source.statements.flatMap((statement): TransitionNode[] => {
        const call = ts.isExpressionStatement(statement) ? unwrap(statement.expression) : undefined
        if (call === undefined || !ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || call.expression.text !== 'describeTransition') {
          return []
        }
        const place = { file, line: lineOf(parsed, call) }
        const name = readString(call.arguments[0]) ?? ''
        const fileName = file.split('/').at(-1)?.replace(/\.test\.tsx$/, '') ?? ''
        if (name !== fileName) {
          problems.push({ ...place, rule: 'transition', message: `画面遷移の名前「${name}」を、ファイルの名前「${fileName}」と同じにする` })
        }
        const traceCalls: ts.CallExpression[] = []
        const visit = (node: ts.Node): void => {
          if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'trace') {
            traceCalls.push(node)
          }
          ts.forEachChild(node, visit)
        }
        visit(call)
        const traces = traceCalls.map((traceCall) => {
          const body = traceCall.arguments[1]
          const edges: TransitionEdgeNode[] = []
          const startIds: string[] = []
          let current: string | null = null
          let pending: { readonly event: string; readonly at: ts.Node } | null = null
          let opening = false
          for (const screenCall of body === undefined ? [] : listScreenCalls(body)) {
            const method = screenCall.expression.name.text
            const [first] = screenCall.arguments
            const at = { file, line: lineOf(parsed, screenCall) }
            if (method === 'expectHeading') {
              const key = readString(first) ?? ''
              const target = screenByHeading.get(key)
              if (target === undefined) {
                problems.push({ ...at, rule: 'transition-step', message: `見出し「${key}」の画面がない（画面の PageTitle の見出しを確かめる）` })
                pending = null
                continue
              }
              if (pending !== null && current !== null && !opening) {
                edges.push({ from: current, to: target, event: pending.event })
              } else if (!startIds.includes(target)) {
                startIds.push(target)
              }
              current = target
              pending = null
              opening = false
              continue
            }
            if (pending !== null) {
              problems.push({ ...at, rule: 'transition-step', message: '画面遷移のテストでは、開く・押す・たどるのあとに expectHeading で遷移先の画面を確かめる' })
            }
            if (method === 'go') {
              const path = navigation.get(readString(first) ?? '')
              opening = true
              pending = { event: screen.labelOf(readString(first) ?? ''), at: screenCall }
              if (path === undefined || screenByPath.get(path) === undefined) {
                problems.push({ ...at, rule: 'transition-step', message: '開く画面は、画面の上のナビゲーションの見出しのキーにする' })
              }
              continue
            }
            const label = method === 'press' ? screen.buttonTextOf(readString(first) ?? '') : (readString(first) ?? (first === undefined ? '' : screen.valueOf(first)))
            pending = { event: `[${label}]`, at: screenCall }
          }
          if (pending !== null) {
            problems.push({ file, line: lineOf(parsed, pending.at), rule: 'transition-step', message: '画面遷移のテストでは、開く・押す・たどるのあとに expectHeading で遷移先の画面を確かめる' })
          }
          return { title: readString(traceCall.arguments[0]) ?? '', startIds, edges }
        })
        return [{ id: name, title: screen.language.noun(name), traces, ...place }]
      })
    })
}
