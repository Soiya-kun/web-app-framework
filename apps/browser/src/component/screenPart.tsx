// 画面の設計書（IPA「機能要件の合意形成ガイド 画面編」）の部品。画面遷移の図・画面レイアウト（矩形の図）・見出しの対応。
import type { ScreenElementNode, ScreenItemNode, ScreenNode, TransitionEdgeNode } from '@app/translator/model-types'
import { labelKey, type LabelKey } from '@app/vocabulary/text'
import { Link } from '@tanstack/react-router'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'
import { arrangeTransition, transitionSize } from './transitionLayout'

/** 部品の種類の見出し。 */
export const partKindLabels: Readonly<Record<ScreenItemNode['kind'], LabelKey>> = {
  heading: labelKey('label'),
  textInput: labelKey('textBox'),
  selectInput: labelKey('listBox'),
  button: labelKey('button'),
  link: labelKey('link'),
  table: labelKey('table'),
  status: labelKey('feedback'),
  alert: labelKey('alert'),
  column: labelKey('column'),
}

/** 分類・データ型の見出し。 */
export const screenKindLabels: Readonly<Record<ScreenNode['kind'], LabelKey>> = { form: labelKey('inputForm'), list: labelKey('listDisplay'), detail: labelKey('detailDisplay') }
export const dataTypeLabels: Readonly<Record<NonNullable<ScreenItemNode['dataType']>, LabelKey>> = { text: labelKey('textType'), number: labelKey('numberType'), date: labelKey('date'), choice: labelKey('selection') }

/** 画面のページへのリンク（画面の名前と画面ID）。 */
export function ScreenLink({ screenId }: { readonly screenId: string }) {
  const { model } = useModel()
  const screen = model.screens.find((item) => item.id === screenId)
  return (
    <Link to="/screen/$screenId" params={{ screenId }} className="whitespace-nowrap text-primary underline">
      {screen === undefined ? screenId : `${screen.title}（${screen.id}）`}
    </Link>
  )
}

/**
 * 画面遷移の図。画面を箱、遷移を矢線、遷移のきっかけを [イベント] で書く（IPA 画面編の表記）。
 * 配置は arrangeTransition（つながった画面ごとに、開始点から近い順に上から並べる）。
 */
export function TransitionDiagram({ label, edges, entryIds }: { readonly label: string; readonly edges: readonly TransitionEdgeNode[]; readonly entryIds: readonly string[] }) {
  const text = useText()
  const { model } = useModel()
  const layout = arrangeTransition(entryIds, edges)
  const readTitle = (screenId: string) => model.screens.find((screen) => screen.id === screenId)?.title ?? screenId

  return (
    <figure aria-label={label} className="overflow-x-auto rounded-control border border-line bg-surface">
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <svg className="pointer-events-none absolute left-0 top-0" width={layout.width} height={layout.height} aria-hidden="true">
          <defs>
            <marker id="transitionHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" className="fill-muted" />
            </marker>
          </defs>
          {layout.routes.map((route) => (
            <path key={route.key} d={route.path} className="fill-none stroke-muted" strokeWidth={1.5} markerEnd="url(#transitionHead)" />
          ))}
        </svg>
        {layout.routes.map((route) => (
          <span key={`${route.key}-label`} className="absolute whitespace-nowrap rounded bg-surface px-1 text-[11px] leading-4 text-ink" style={route.label}>
            {route.events}
          </span>
        ))}
        {layout.boxes.map((box) => (
          <div key={box.screenId} className="absolute" style={{ left: box.left, top: box.top, width: transitionSize.width }}>
            {entryIds.includes(box.screenId) ? <span className="absolute -top-5 left-0 text-[11px] text-muted">《{text.label('entryPoint')}》</span> : null}
            <Link
              to="/screen/$screenId"
              params={{ screenId: box.screenId }}
              className="flex flex-col justify-center rounded-control border-2 border-ink bg-surface px-2 hover:shadow"
              style={{ height: transitionSize.height }}
            >
              <span className="text-xs font-bold leading-snug">{readTitle(box.screenId)}</span>
              <span className="font-mono text-[10px] text-muted">{box.screenId}</span>
            </Link>
          </div>
        ))}
      </div>
    </figure>
  )
}

/** 識別ID の印。 */
function PartNumber({ number }: { readonly number: string }) {
  return <span className="mr-1 inline-block rounded-full border border-muted px-1 font-mono text-[10px] text-muted">{number}</span>
}

/** 画面レイアウト（矩形で表した図）。部品を JSX に書いた順に並べ、識別ID を付ける。 */
export function ScreenLayout({ screen }: { readonly screen: ScreenNode }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const renderElement = (element: ScreenElementNode) => {
    switch (element.kind) {
      case 'heading':
        return (
          <p className="text-base font-bold">
            <PartNumber number={element.number} />
            {element.label}
          </p>
        )
      case 'textInput':
      case 'selectInput':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-xs">
              <PartNumber number={element.number} />
              {element.label}
            </span>
            <span className="flex h-7 items-center justify-between rounded-control border border-muted bg-surface px-2 text-[11px] text-muted">
              <span>{element.placeholder ?? screen.items.find((item) => item.number === element.number)?.initial ?? ''}</span>
              {element.kind === 'selectInput' ? <span>▼</span> : null}
            </span>
          </div>
        )
      case 'button':
        return (
          <span className="inline-flex items-center rounded-control border-2 border-ink px-3 py-1 text-xs font-medium">
            <PartNumber number={element.number} />
            {element.label}
          </span>
        )
      case 'link':
        return (
          <span className="text-xs text-primary underline">
            <PartNumber number={element.number} />
            {element.label}
          </span>
        )
      case 'table':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-xs">
              <PartNumber number={element.number} />
              {element.label}
            </span>
            <table aria-label={element.label} className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  {element.columns.map((column) => (
                    <th key={column.label} className={`border border-muted px-1 font-normal text-muted ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1].map((row) => (
                  <tr key={row}>
                    {element.columns.map((column) => (
                      <td key={column.label} className="h-5 border border-muted" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'status':
      case 'alert':
        return (
          <p className={`rounded-control border px-2 py-1 text-[11px] ${element.kind === 'alert' ? 'border-pending-line bg-event' : 'border-line bg-canvas'}`}>
            <PartNumber number={element.number} />
            {element.label}
          </p>
        )
    }
  }
  return (
    <figure aria-label={labelFormat.joinItem(screen.title, text.label('screenLayout'))} className="max-w-xl rounded-control border-2 border-ink bg-surface">
      <div className="border-b border-line bg-canvas px-3 py-1 font-mono text-[10px] text-muted">{screen.path}</div>
      <div className="flex flex-col gap-3 p-4">
        {screen.elements.map((element) => (
          <div key={element.number}>{renderElement(element)}</div>
        ))}
      </div>
    </figure>
  )
}
