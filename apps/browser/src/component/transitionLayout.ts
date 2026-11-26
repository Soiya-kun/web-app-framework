// 画面遷移の図の配置。つながった画面のまとまり（領域）ごとに左から並べ、領域の中は開始点から近い順に上から段（レイヤー）に置く。
// 矢線は箱の上下の辺から出入りし、横の線は段のあいだの通り道（行のレーン）に、段をまたいで戻る縦の線は領域の右の通り道（横のレーン）に通す。
// 1本の通り道には1本の矢線だけを通すので、線どうしが重ならず、[イベント] の見出しも行のレーンごとに別の高さになる。
import type { TransitionEdgeNode } from '@app/translator/model-types'

export const transitionSize = {
  width: 176,
  height: 52,
  columnMargin: 104,
  areaMargin: 56,
  side: 24,
  lane: 18,
  sideLane: 14,
} as const

export type TransitionBox = { readonly screenId: string; readonly left: number; readonly top: number }
export type TransitionRoute = {
  readonly key: string
  readonly path: string
  readonly label: { readonly left: number; readonly top: number }
  readonly events: string
}
export type TransitionLayout = {
  readonly width: number
  readonly height: number
  readonly boxes: readonly TransitionBox[]
  readonly routes: readonly TransitionRoute[]
}

/**
 * 矢線の通し方。right は同じ段の右隣へまっすぐ、down は1つ下の段へ、under は同じ段の右隣以外（下を回る）、
 * around は上の段へ戻る・2段以上下がる（領域の右を回る）。
 */
type RouteKind = 'right' | 'down' | 'under' | 'around'
type EdgeGroup = { readonly key: string; readonly from: string; readonly to: string; readonly events: string }
type EdgePlace = EdgeGroup & { readonly kind: RouteKind; readonly area: number; readonly lanes: readonly { readonly row: number; readonly index: number }[]; readonly sideLane: number }

/** 同じ2つの画面の遷移はまとめ、イベントを並べる。 */
function joinEdges(edges: readonly TransitionEdgeNode[]): EdgeGroup[] {
  const groups = new Map<string, { from: string; to: string; events: string[] }>()
  for (const edge of edges) {
    const key = `${edge.from}>${edge.to}`
    const group = groups.get(key) ?? { from: edge.from, to: edge.to, events: [] }
    group.events.push(edge.event)
    groups.set(key, group)
  }
  return [...groups].map(([key, group]) => ({ key, from: group.from, to: group.to, events: [...new Set(group.events)].join(' ') }))
}

/** 画面を、向きを問わないつながりで領域に分ける。並びは最初に出てきた順。 */
function splitAreas(screenIds: readonly string[], edgeGroups: readonly EdgeGroup[]): string[][] {
  const areaIndex = new Map<string, number>()
  const areas: string[][] = []
  for (const screenId of screenIds) {
    if (areaIndex.has(screenId)) {
      continue
    }
    const area = [screenId]
    areaIndex.set(screenId, areas.length)
    for (let index = 0; index < area.length; index += 1) {
      const screen = area[index]
      for (const edge of edgeGroups) {
        const other = edge.from === screen ? edge.to : edge.to === screen ? edge.from : undefined
        if (other !== undefined && !areaIndex.has(other)) {
          areaIndex.set(other, areas.length)
          area.push(other)
        }
      }
    }
    areas.push(area.sort((first, other) => screenIds.indexOf(first) - screenIds.indexOf(other)))
  }
  return areas
}

/**
 * 領域の中の段。開始点を順に見て、まだ段のない開始点を0段にし、遷移をたどって1段ずつ下げる
 * （ほかの開始点からたどれる開始点は、たどった先の段に入る）。どこからもたどれない画面も0段から始める。
 */
function assignLayers(area: readonly string[], entryIds: readonly string[], edgeGroups: readonly EdgeGroup[]): string[][] {
  const layer = new Map<string, number>()
  for (const root of [...area.filter((screenId) => entryIds.includes(screenId)), ...area]) {
    if (layer.has(root)) {
      continue
    }
    layer.set(root, 0)
    let row = [root]
    while (row.length > 0) {
      const next: string[] = []
      for (const edge of edgeGroups) {
        if (row.includes(edge.from) && !layer.has(edge.to)) {
          layer.set(edge.to, (layer.get(edge.from) ?? 0) + 1)
          next.push(edge.to)
        }
      }
      row = next
    }
  }
  const layers: string[][] = []
  for (const [screenId, index] of layer) {
    layers[index] = [...(layers[index] ?? []), screenId]
  }
  // 2段目からは、上の段から来る遷移の元の列の平均で並べ替え、線の交差を減らす。
  for (let index = 1; index < layers.length; index += 1) {
    const previousRow = layers[index - 1] ?? []
    const measureColumn = (screenId: string) => {
      const columns = edgeGroups.filter((edge) => edge.to === screenId && previousRow.includes(edge.from)).map((edge) => previousRow.indexOf(edge.from))
      return columns.length === 0 ? Number.MAX_SAFE_INTEGER : columns.reduce((sum, column) => sum + column, 0) / columns.length
    }
    layers[index] = [...(layers[index] ?? [])].sort((first, other) => measureColumn(first) - measureColumn(other))
  }
  return layers.map((items) => items ?? [])
}

/** 画面遷移の図の配置を決める。 */
export function arrangeTransition(entryIds: readonly string[], edges: readonly TransitionEdgeNode[]): TransitionLayout {
  const size = transitionSize
  const screenIds = [...new Set([...entryIds, ...edges.flatMap((edge) => [edge.from, edge.to])])]
  const edgeGroups = joinEdges(edges)
  const areas = splitAreas(screenIds, edgeGroups).map((area) => assignLayers(area, entryIds, edgeGroups))
  const point = new Map<string, { area: number; layer: number; column: number }>()
  areas.forEach((layers, area) => layers.forEach((items, layer) => items.forEach((screenId, column) => point.set(screenId, { area, layer, column }))))
  const layerCount = Math.max(1, ...areas.map((layers) => layers.length))

  // 矢線の通し方と通り道。行のレーンは段のあいだ（row 番目の段の上。layerCount はいちばん下の段の下）。
  const rowLanes = new Map<string, number>()
  const sideLanes = areas.map(() => 0)
  const takeLane = (area: number, row: number) => {
    const key = `${area}-${row}`
    const index = rowLanes.get(key) ?? 0
    rowLanes.set(key, index + 1)
    return { row, index }
  }
  const places: EdgePlace[] = edgeGroups.flatMap((edge): EdgePlace[] => {
    const from = point.get(edge.from)
    const to = point.get(edge.to)
    if (from === undefined || to === undefined) {
      return []
    }
    if (to.layer === from.layer && to.column === from.column + 1) {
      return [{ ...edge, kind: 'right', area: from.area, lanes: [], sideLane: -1 }]
    }
    if (to.layer === from.layer + 1) {
      return [{ ...edge, kind: 'down', area: from.area, lanes: [takeLane(from.area, to.layer)], sideLane: -1 }]
    }
    if (to.layer === from.layer) {
      return [{ ...edge, kind: 'under', area: from.area, lanes: [takeLane(from.area, from.layer + 1)], sideLane: -1 }]
    }
    const sideLane = sideLanes[from.area] ?? 0
    sideLanes[from.area] = sideLane + 1
    return [{ ...edge, kind: 'around', area: from.area, lanes: [takeLane(from.area, from.layer + 1), takeLane(from.area, to.layer)], sideLane }]
  })

  // 段のあいだの高さ。通り道の数に合わせて広げ、下の段の《開始点》の見出しの分を空ける。
  const measureLaneCount = (row: number) => Math.max(0, ...areas.map((_, area) => rowLanes.get(`${area}-${row}`) ?? 0))
  const measureRowHeight = (row: number) => {
    const count = measureLaneCount(row)
    if (count === 0) {
      return row === 0 ? 28 : row === layerCount ? 16 : 64
    }
    return 20 + (count - 1) * size.lane + (row === layerCount ? 12 : 32)
  }
  const rowTops: number[] = []
  let top = 0
  for (let row = 0; row <= layerCount; row += 1) {
    rowTops[row] = top
    top += measureRowHeight(row) + size.height
  }
  const height = top - size.height
  const measureLaneTop = (lane: { row: number; index: number }) => (rowTops[lane.row] ?? 0) + 20 + lane.index * size.lane
  const measureLayerTop = (layer: number) => (rowTops[layer] ?? 0) + measureRowHeight(layer)

  // 領域の左端と右端（右の通り道の手前）。
  const areaLeftList: number[] = []
  const areaRightList: number[] = []
  let left = size.side
  areas.forEach((layers, area) => {
    const columns = Math.max(1, ...layers.map((items) => items.length))
    areaLeftList[area] = left
    areaRightList[area] = left + columns * (size.width + size.columnMargin) - size.columnMargin
    left = (areaRightList[area] ?? 0) + ((sideLanes[area] ?? 0) > 0 ? 24 + (sideLanes[area] ?? 0) * size.sideLane : 0) + size.areaMargin
  })
  const width = left - size.areaMargin + size.side
  const boxes: TransitionBox[] = screenIds.flatMap((screenId) => {
    const screenPoint = point.get(screenId)
    return screenPoint === undefined ? [] : [{ screenId, left: (areaLeftList[screenPoint.area] ?? 0) + screenPoint.column * (size.width + size.columnMargin), top: measureLayerTop(screenPoint.layer) }]
  })
  const boxTable = new Map(boxes.map((box) => [box.screenId, box]))
  const measureCenter = (screenId: string) => (boxTable.get(screenId)?.left ?? 0) + size.width / 2
  const measureSideLane = (edge: EdgePlace) => (areaRightList[edge.area] ?? 0) + 24 + edge.sideLane * size.sideLane

  // 箱の上下の辺の出入り口。1つの辺の出入り口は、相手の側の左右の順に等間隔に並べる。
  const ports = new Map<string, { key: string; left: number }[]>()
  const attachPort = (screenId: string, side: 'top' | 'bottom', key: string, left: number) => {
    const portKey = `${screenId}-${side}`
    ports.set(portKey, [...(ports.get(portKey) ?? []), { key, left }])
  }
  for (const edge of places) {
    switch (edge.kind) {
      case 'right':
        break
      case 'down':
        attachPort(edge.from, 'bottom', edge.key, measureCenter(edge.to))
        attachPort(edge.to, 'top', edge.key, measureCenter(edge.from))
        break
      case 'under':
        attachPort(edge.from, 'bottom', edge.key, measureCenter(edge.to))
        attachPort(edge.to, 'bottom', `${edge.key}<`, measureCenter(edge.from))
        break
      case 'around':
        attachPort(edge.from, 'bottom', edge.key, measureSideLane(edge))
        attachPort(edge.to, 'top', edge.key, measureSideLane(edge))
        break
    }
  }
  const measurePort = (screenId: string, side: 'top' | 'bottom', key: string) => {
    const items = [...(ports.get(`${screenId}-${side}`) ?? [])].sort((first, other) => first.left - other.left)
    const index = items.findIndex((item) => item.key === key)
    return (boxTable.get(screenId)?.left ?? 0) + (size.width * (index + 1)) / (items.length + 1)
  }

  const routes = places.flatMap((edge): TransitionRoute[] => {
    const from = boxTable.get(edge.from)
    const to = boxTable.get(edge.to)
    if (from === undefined || to === undefined) {
      return []
    }
    const fromBottom = from.top + size.height
    const [firstLane, lastLane] = edge.lanes
    switch (edge.kind) {
      case 'right': {
        const middle = from.top + size.height / 2
        return [{ key: edge.key, path: `M${from.left + size.width},${middle} H${to.left - 2}`, label: { left: from.left + size.width + 6, top: middle - 17 }, events: edge.events }]
      }
      case 'down':
      case 'under': {
        const laneTop = firstLane === undefined ? fromBottom : measureLaneTop(firstLane)
        const fromLeft = measurePort(edge.from, 'bottom', edge.key)
        const toLeft = edge.kind === 'down' ? measurePort(edge.to, 'top', edge.key) : measurePort(edge.to, 'bottom', `${edge.key}<`)
        const end = edge.kind === 'down' ? to.top - 2 : to.top + size.height + 2
        return [{ key: edge.key, path: `M${fromLeft},${fromBottom} V${laneTop} H${toLeft} V${end}`, label: { left: toLeft + 6, top: laneTop - 16 }, events: edge.events }]
      }
      case 'around': {
        const firstTop = firstLane === undefined ? fromBottom : measureLaneTop(firstLane)
        const lastTop = lastLane === undefined ? to.top : measureLaneTop(lastLane)
        const sideLeft = measureSideLane(edge)
        const fromLeft = measurePort(edge.from, 'bottom', edge.key)
        const toLeft = measurePort(edge.to, 'top', edge.key)
        return [
          {
            key: edge.key,
            path: `M${fromLeft},${fromBottom} V${firstTop} H${sideLeft} V${lastTop} H${toLeft} V${to.top - 2}`,
            label: { left: toLeft + 6, top: lastTop - 16 },
            events: edge.events,
          },
        ]
      }
    }
  })
  return { width, height, boxes, routes }
}
