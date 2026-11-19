// キャンバスの中の部品から、視点を動かす・倍率を読むための口。
import { createContext, use } from 'react'

export type CanvasAction = {
  /** フレームが画面に収まるように視点を動かす。 */
  focusFrame(flowId: string): void
  /** いまの倍率（ドラッグの量を、キャンバスの上の長さに直すのに使う）。 */
  readScale(): number
}

const CanvasActionContext = createContext<CanvasAction>({ focusFrame: () => undefined, readScale: () => 1 })

export const CanvasActionProvider = CanvasActionContext

export function useCanvasAction(): CanvasAction {
  return use(CanvasActionContext)
}
