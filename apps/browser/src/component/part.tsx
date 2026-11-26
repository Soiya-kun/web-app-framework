// 画面の小さな部品。色・余白はここと style.css のトークンだけで決める。
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { readOtherLocale, useLocale } from '../text'

export function PageTitle({ level, children }: { readonly level?: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {level === undefined ? null : <p className="text-xs font-medium text-muted">{level}</p>}
      <h1 className="text-2xl font-bold">{children}</h1>
    </div>
  )
}

export function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-control border border-line bg-surface p-4">
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  )
}

export function Badge({ tone = 'plain', children }: { readonly tone?: 'plain' | 'pending' | 'primary'; readonly children: ReactNode }) {
  const toneClass = {
    plain: 'border-line bg-canvas text-muted',
    pending: 'border-pending-line bg-pending text-pending-line',
    primary: 'border-primary bg-primary-soft text-primary',
  }[tone]
  return <span className={`inline-block rounded-control border px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>
}

/** 手順の番号付きの並び。 */
export function StepList({ label, steps }: { readonly label: string; readonly steps: readonly ReactNode[] }) {
  return (
    <ol aria-label={label} className="flex list-decimal flex-col gap-1 pl-6 text-sm">
      {steps.map((step, index) => (
        <li key={index}>{step}</li>
      ))}
    </ol>
  )
}

/** ソースの場所（ファイル:行）。 */
export function SourcePlace({ file, line }: { readonly file: string; readonly line: number }) {
  return (
    <p className="font-mono text-xs text-muted">
      {file}:{line}
    </p>
  )
}

export function TextLink({
  to,
  params,
  children,
}: {
  readonly to: string
  readonly params?: Readonly<Record<string, string>>
  readonly children: ReactNode
}) {
  return (
    <Link to={to} params={params} className="text-primary underline underline-offset-2">
      {children}
    </Link>
  )
}

export function Table({ caption, children }: { readonly caption: string; readonly children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

export function HeaderCell({ children }: { readonly children: ReactNode }) {
  return (
    <th scope="col" className="whitespace-nowrap border-b border-line px-2 py-1.5 text-left font-medium text-muted">
      {children}
    </th>
  )
}

export function Cell({ children }: { readonly children: ReactNode }) {
  return <td className="border-b border-line px-2 py-1.5 align-top">{children}</td>
}

/** 言語の切り替え。押すと、もう一方の言語（日本語・English）にする。 */
export function LocaleToggle({ className = '' }: { readonly className?: string }) {
  const { locale, selectLocale, text } = useLocale()
  const other = readOtherLocale(locale)
  return (
    <button
      type="button"
      lang={other.locale}
      aria-label={`${text.label('locale')}: ${other.title}`}
      onClick={() => selectLocale(other.locale)}
      className={`rounded-lg px-2.5 py-1 text-muted hover:bg-canvas hover:text-ink ${className}`}
    >
      {other.title}
    </button>
  )
}
