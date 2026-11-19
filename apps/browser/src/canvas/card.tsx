// キャンバスのカードと、その中の折りたためる区画。
import type { ReactNode } from 'react'
import { useCanvasState, useCanvasStore } from './canvasStore'
import { ChevronIcon } from './icon'

export type CardTone = 'scenario' | 'work' | 'statement' | 'table' | 'note'

const toneStyle: Readonly<Record<CardTone, string>> = {
  scenario: 'bg-operate',
  work: 'bg-work',
  statement: 'bg-statement',
  table: 'bg-table',
  note: 'bg-outside-mark',
}

/** カード。見出しの高さは 54px にそろえ、線が見出しの中心に当たるようにする。 */
export function Card({
  path,
  tone,
  kind,
  title,
  width,
  children,
}: {
  /** キャンバスの中での道筋（探したカードへ寄せるときに使う）。 */
  readonly path: string
  readonly tone: CardTone
  readonly kind: string
  readonly title: string
  readonly width: number
  readonly children: ReactNode
}) {
  return (
    <article
      data-card
      data-path={path}
      aria-label={title}
      className="animate-appear cursor-auto rounded-xl border border-line/70 bg-surface shadow-[var(--shadow-card)]"
      style={{ width }}
    >
      <header className="flex h-[54px] items-center gap-2 border-b border-line/60 px-4">
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white ${toneStyle[tone]}`}>{kind}</span>
        <h3 className="truncate text-sm font-bold">{title}</h3>
      </header>
      <div className="flex flex-col gap-3 px-4 py-3 text-[13px] leading-relaxed">{children}</div>
    </article>
  )
}

/** カードの中の、押すと開く区画。開閉はキャンバスの状態に保存する（path ごと）。 */
export function Fold({
  path,
  title,
  count,
  initialOpened = false,
  children,
}: {
  readonly path: string
  readonly title: ReactNode
  readonly count?: number
  readonly initialOpened?: boolean
  readonly children: ReactNode
}) {
  const store = useCanvasStore()
  const opened = useCanvasState((state) => state.folds[path] ?? initialOpened)
  const changeOpened = (toggle: (current: boolean) => boolean) =>
    store.update((state) => ({ ...state, folds: { ...state.folds, [path]: toggle(state.folds[path] ?? initialOpened) } }))
  return (
    <section className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-expanded={opened}
        onClick={() => changeOpened((current) => !current)}
        className="flex items-center gap-1.5 rounded-md text-left text-xs font-bold text-muted hover:text-ink"
      >
        <ChevronIcon opened={opened} />
        <span>{title}</span>
        {count === undefined ? null : <span className="rounded-full bg-canvas px-1.5 text-[10px] font-medium text-muted">{count}</span>}
      </button>
      {opened ? <div className="pl-5">{children}</div> : null}
    </section>
  )
}

/** 押すと右に子のカードを開く行（処理・SQL・テーブル）。 */
export function BranchToggle({
  opened,
  onToggle,
  children,
}: {
  readonly opened: boolean
  readonly onToggle: () => void
  readonly children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={opened}
      onClick={onToggle}
      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[13px] transition-colors ${
        opened ? 'border-select bg-select/10 text-ink' : 'border-line/70 bg-surface hover:border-select/60'
      }`}
    >
      {children}
      <span className={`ml-auto text-xs ${opened ? 'text-select' : 'text-muted'}`} aria-hidden="true">
        {opened ? '●' : '→'}
      </span>
    </button>
  )
}

export function StepLines({ label, steps }: { readonly label: string; readonly steps: readonly string[] }) {
  return (
    <ol aria-label={label} className="flex list-decimal flex-col gap-0.5 pl-5 marker:text-muted">
      {steps.map((step, index) => (
        <li key={index}>{step}</li>
      ))}
    </ol>
  )
}
