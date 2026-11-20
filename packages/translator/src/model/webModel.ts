// 画面を読む。道筋（router）→ 画面の部品 → ボタン → mutation → API を呼ぶ関数 → API の入口。
import ts from 'typescript'
import { collectCalls, collectIdentifiers, isExported, lineOf, readProperty, readString, unwrap, type ParsedSource, type SourceReader } from './source'
import type { PageActionNode, PageNode } from './types'
import type { ActionKey, LabelKey, Text } from '@app/vocabulary/text'
import { prepareLanguage, type Language } from '../language'

const webRoot = 'apps/web/src'
const routerFile = `${webRoot}/shared/router.tsx`

export type WebModel = {
  readonly pages: PageNode[]
  /** ナビゲーションの見出しのキー → 道筋。 */
  readonly navigation: ReadonlyMap<string, string>
}

/** apiClient.api.payments[':paymentId'].identify.$post → POST /api/payments/:paymentId/identify */
function readEndpointOfCall(call: ts.CallExpression): string | undefined {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee) || !callee.name.text.startsWith('$')) {
    return undefined
  }
  const method = callee.name.text.slice(1).toUpperCase()
  const segments: string[] = []
  let node: ts.Expression = callee.expression
  while (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    if (ts.isPropertyAccessExpression(node)) {
      segments.unshift(node.name.text)
    } else {
      const segment = readString(node.argumentExpression)
      if (segment === undefined) {
        return undefined
      }
      segments.unshift(segment)
    }
    node = node.expression
  }
  if (segments[0] !== 'api') {
    return undefined
  }
  return `${method} /${segments.join('/')}`
}

/** 画面の API を呼ぶ関数（*Api.ts の export）→ API の入口。 */
function readApiFunctions(reader: SourceReader): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const file of reader.list(webRoot, (path) => /Api\.tsx?$/.test(path))) {
    const parsed = reader.read(file)
    for (const statement of parsed.source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name !== undefined && isExported(statement)) {
        const endpoints = collectCalls(statement).flatMap((call) => {
          const endpoint = readEndpointOfCall(call)
          return endpoint === undefined ? [] : [endpoint]
        })
        result.set(`${file}#${statement.name.text}`, [...new Set(endpoints)])
      }
    }
  }
  return result
}

function apiEndpointsIn(parsed: ParsedSource, node: ts.Node, apiFunctions: ReadonlyMap<string, string[]>): string[] {
  return [
    ...new Set(
      [...collectIdentifiers(node)].flatMap((name) => {
        const imported = parsed.imports.get(name)
        return imported?.file === null || imported === undefined ? [] : (apiFunctions.get(`${imported.file}#${imported.name}`) ?? [])
      }),
    ),
  ]
}

/** JSX の要素の名前。 */
function tagNameOf(node: ts.Node): string | undefined {
  if (ts.isJsxElement(node)) {
    return node.openingElement.tagName.getText()
  }
  if (ts.isJsxSelfClosingElement(node)) {
    return node.tagName.getText()
  }
  return undefined
}

function attributeOf(node: ts.JsxElement | ts.JsxSelfClosingElement, name: string): ts.JsxAttribute | undefined {
  const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes
  return attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === name)
}

function attributeExpression(attribute: ts.JsxAttribute | undefined): ts.Node | undefined {
  const initializer = attribute?.initializer
  if (initializer === undefined) {
    return undefined
  }
  return ts.isJsxExpression(initializer) ? initializer.expression : initializer
}

/** ボタンの文言（text.action('issue') →「発行」、text.label('closingCancel') →「締めの取消」）。 */
function buttonNameOf(text: Text, node: ts.Node): string | undefined {
  for (const call of collectCalls(node)) {
    if (ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression) && call.expression.expression.text === 'text') {
      const key = readString(call.arguments[0])
      if (key !== undefined && call.expression.name.text === 'action') {
        return text.action(key as ActionKey)
      }
      if (key !== undefined && call.expression.name.text === 'label') {
        return text.label(key as LabelKey)
      }
    }
  }
  return undefined
}

function readPage(text: Text, reader: SourceReader, file: string, component: string, apiFunctions: ReadonlyMap<string, string[]>) {
  const parsed = reader.read(file)
  const componentNode = parsed.source.statements.find(
    (statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === component,
  )
  if (componentNode?.body === undefined) {
    return { queryEndpointIds: [], actions: [], links: [], line: 1 }
  }
  // mutation の変数 → 呼ぶ API の入口。
  const mutations = new Map<string, string[]>()
  const queries: string[] = []
  const functions = new Map<string, ts.Node>()
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
      const initializer = unwrap(node.initializer)
      if (ts.isCallExpression(initializer) && ts.isIdentifier(initializer.expression)) {
        if (initializer.expression.text === 'useMutation') {
          mutations.set(node.name.text, apiEndpointsIn(parsed, initializer, apiFunctions))
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useSuspenseQuery') {
      queries.push(...apiEndpointsIn(parsed, node, apiFunctions))
    }
    if (ts.isFunctionDeclaration(node) && node.name !== undefined && node.body !== undefined) {
      functions.set(node.name.text, node.body)
    }
    ts.forEachChild(node, visit)
  }
  visit(componentNode.body)
  const mutationsIn = (node: ts.Node | undefined, seen = new Set<ts.Node>()): string[] => {
    if (node === undefined || seen.has(node)) {
      return []
    }
    seen.add(node)
    const names = collectIdentifiers(node)
    return [
      ...new Set([
        ...[...names].flatMap((name) => mutations.get(name) ?? []),
        ...[...names].flatMap((name) => mutationsIn(functions.get(name), seen)),
      ]),
    ]
  }
  const actions: PageActionNode[] = []
  const links: { to: string; inTable: boolean }[] = []
  const visitJsx = (node: ts.Node, ancestors: readonly (ts.JsxElement | ts.JsxSelfClosingElement)[]): void => {
    const tag = tagNameOf(node)
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && tag !== undefined) {
      if (tag === 'Button' || tag === 'button') {
        const button = buttonNameOf(text, node)
        const onClick = attributeExpression(attributeOf(node, 'onClick'))
        const form = [...ancestors].reverse().find((ancestor) => tagNameOf(ancestor) === 'form')
        const handler = onClick ?? (form === undefined ? undefined : attributeExpression(attributeOf(form, 'onSubmit')))
        if (button !== undefined) {
          actions.push({ button, endpointIds: mutationsIn(handler) })
        }
      }
      if (tag === 'Link') {
        const to = readString(attributeExpression(attributeOf(node, 'to')) as ts.Expression | undefined)
        if (to !== undefined) {
          links.push({ to, inTable: ancestors.some((ancestor) => ['Table', 'table', 'tr', 'Cell'].includes(tagNameOf(ancestor) ?? '')) })
        }
      }
      const nextAncestors = [...ancestors, node]
      ts.forEachChild(node, (child) => visitJsx(child, nextAncestors))
      return
    }
    ts.forEachChild(node, (child) => visitJsx(child, ancestors))
  }
  visitJsx(componentNode.body, [])
  return { queryEndpointIds: [...new Set(queries)], actions, links, line: lineOf(parsed, componentNode) }
}

export function readWebModel(reader: SourceReader, language: Language = prepareLanguage('ja')): WebModel {
  const { text } = language
  if (!reader.exists(routerFile)) {
    return { pages: [], navigation: new Map() }
  }
  const apiFunctions = readApiFunctions(reader)
  const router = reader.read(routerFile)
  const navigation = new Map<string, string>()
  const navigationTitles = new Map<string, string>()
  const pages: PageNode[] = []
  for (const call of collectCalls(router.source)) {
    if (ts.isIdentifier(call.expression) && call.expression.text === 'labelKey' && ts.isPropertyAssignment(call.parent)) {
      const object = call.parent.parent
      const key = readString(call.arguments[0])
      const path = ts.isObjectLiteralExpression(object) ? readString(readProperty(object, 'path')) : undefined
      if (key !== undefined && path !== undefined) {
        navigation.set(key, path)
        navigationTitles.set(path, text.label(key as LabelKey))
      }
    }
    if (ts.isIdentifier(call.expression) && call.expression.text === 'createRoute') {
      const [options] = call.arguments
      if (options === undefined || !ts.isObjectLiteralExpression(options)) {
        continue
      }
      const path = readString(readProperty(options, 'path'))
      const component = readProperty(options, 'component')
      const loader = readProperty(options, 'loader')
      if (path === undefined || component === undefined || !ts.isIdentifier(component)) {
        continue
      }
      const pageFile = router.imports.get(component.text)?.file
      const page = pageFile === null || pageFile === undefined ? null : readPage(text, reader, pageFile, component.text, apiFunctions)
      const loaderEndpoints = loader === undefined ? [] : apiEndpointsIn(router, loader, apiFunctions)
      pages.push({
        id: path,
        title: navigationTitles.get(path) ?? language.noun(component.text.replace(/Page$/, '').replace(/^./, (letter) => letter.toLowerCase())),
        component: component.text,
        queryEndpointIds: [...new Set([...loaderEndpoints, ...(page?.queryEndpointIds ?? [])])],
        actions: page?.actions ?? [],
        links: page?.links ?? [],
        file: pageFile ?? routerFile,
        line: page?.line ?? lineOf(router, call),
      })
    }
  }
  // ナビゲーションより先に道筋を読んだ画面の見出しを入れ直す。
  return {
    navigation,
    pages: pages.map((page) => ({ ...page, title: navigationTitles.get(page.id) ?? page.title })),
  }
}
