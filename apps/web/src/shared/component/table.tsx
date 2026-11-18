import type { ReactNode } from 'react'
import { joinClassNames } from './className'

/** 表。caption は表の名前（読み上げ・テストで表を探すのに使う）。 */
export function Table({ caption, children }: { readonly caption: string; readonly children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-control border border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="border-b border-line bg-canvas px-3 py-2 text-left font-medium">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

export function HeaderCell({ align = 'left', children }: { readonly align?: 'left' | 'right'; readonly children: ReactNode }) {
  return (
    <th
      scope="col"
      className={joinClassNames('border-b border-line px-3 py-2 font-medium text-muted', align === 'right' ? 'text-right' : 'text-left')}
    >
      {children}
    </th>
  )
}

export function Cell({ align = 'left', children }: { readonly align?: 'left' | 'right'; readonly children: ReactNode }) {
  return (
    <td className={joinClassNames('border-b border-line px-3 py-2', align === 'right' && 'text-right tabular-nums')}>
      {children}
    </td>
  )
}
