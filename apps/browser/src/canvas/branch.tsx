// 親のカードの右に、開いた子のカードを縦に並べ、線でつなぐ（木の形）。線は、カードの見出しの高さから出る。
import type { ReactNode } from 'react'

/** カードの見出しの中心の高さ（Card の見出しの高さの半分）。 */
const headerMiddle = 27
const childMargin = 16

export type BranchChild = { readonly key: string; readonly node: ReactNode }

export function Branch({ parent, branches }: { readonly parent: ReactNode; readonly branches: readonly BranchChild[] }) {
  return (
    <div className="flex items-start">
      {parent}
      {branches.length === 0 ? null : (
        <div className="flex items-start">
          <div className="h-0.5 w-8 shrink-0 bg-wire" style={{ marginTop: headerMiddle }} />
          <ul className="flex flex-col" style={{ gap: childMargin }}>
            {branches.map((branch, index) => {
              const isFirst = index === 0
              const isLast = index === branches.length - 1
              return (
                <li key={branch.key} className="relative pl-8">
                  {branches.length > 1 ? (
                    <span
                      className="absolute left-0 w-0.5 bg-wire"
                      style={isLast ? { top: 0, height: headerMiddle + 1 } : { top: isFirst ? headerMiddle : 0, bottom: -childMargin }}
                    />
                  ) : null}
                  <span className="absolute left-0 h-0.5 w-8 bg-wire" style={{ top: headerMiddle }} />
                  {branch.node}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
