// ミニマップ。キャンバス全体の中で、フレームの位置と、いま見ている範囲を小さく出す。押した・ドラッグしたところへ視点を動かす。
import type { PointerEvent } from 'react'
import { useModel } from '../model'
import { useText } from '../text'
import type { CanvasView } from './canvasStore'
import { emptyFrame, useCanvasState } from './canvasStore'

export type FrameArea = { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

const minimapWidth = 200
const minimapHeight = 128
const minimapMargin = 120

export function CanvasMinimap({
  frameAreas,
  view,
  viewportWidth,
  viewportHeight,
  onPoint,
}: {
  /** フレームの自動の配置での領域（ドラッグでずらした分は含まない）。 */
  readonly frameAreas: ReadonlyMap<string, FrameArea>
  readonly view: CanvasView
  readonly viewportWidth: number
  readonly viewportHeight: number
  /** キャンバスの上の点を、画面の中央にする。 */
  readonly onPoint: (left: number, top: number) => void
}) {
  const text = useText()
  const { flows } = useModel()
  const frames = useCanvasState((state) => state.frames)
  const areas = [...frameAreas.entries()].map(([flowId, area]) => {
    const frame = frames[flowId] ?? emptyFrame
    return { flowId, left: area.left + frame.offsetLeft, top: area.top + frame.offsetTop, width: area.width, height: area.height }
  })
  const visible = {
    left: -view.left / view.scale,
    top: -view.top / view.scale,
    width: viewportWidth / view.scale,
    height: viewportHeight / view.scale,
  }
  const boxes = [...areas, visible]
  const boundLeft = Math.min(...boxes.map((box) => box.left)) - minimapMargin
  const boundTop = Math.min(...boxes.map((box) => box.top)) - minimapMargin
  const boundWidth = Math.max(...boxes.map((box) => box.left + box.width)) + minimapMargin - boundLeft
  const boundHeight = Math.max(...boxes.map((box) => box.top + box.height)) + minimapMargin - boundTop
  const minimapScale = Math.min(minimapWidth / boundWidth, minimapHeight / boundHeight)
  const measured = areas.length > 0 && Number.isFinite(minimapScale) && minimapScale > 0
  const place = (box: FrameArea) => ({
    left: (box.left - boundLeft) * minimapScale,
    top: (box.top - boundTop) * minimapScale,
    width: Math.max(2, box.width * minimapScale),
    height: Math.max(2, box.height * minimapScale),
  })
  const focusPoint = (event: PointerEvent<HTMLDivElement>) => {
    if (!measured || (event.type === 'pointermove' && event.buttons !== 1)) {
      return
    }
    const rectangle = event.currentTarget.getBoundingClientRect()
    onPoint(boundLeft + (event.clientX - rectangle.left) / minimapScale, boundTop + (event.clientY - rectangle.top) / minimapScale)
  }

  return (
    <div
      role="img"
      aria-label={text.label('minimap')}
      onPointerDown={focusPoint}
      onPointerMove={focusPoint}
      className="relative cursor-pointer overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-float)]"
      style={{ width: minimapWidth, height: minimapHeight }}
    >
      {measured
        ? areas.map((area) => (
            <div key={area.flowId} title={flows.get(area.flowId)?.title} className="absolute rounded-sm bg-line" style={place(area)} />
          ))
        : null}
      {measured ? <div className="absolute rounded-sm border-2 border-select bg-select/10" style={place(visible)} /> : null}
    </div>
  )
}
