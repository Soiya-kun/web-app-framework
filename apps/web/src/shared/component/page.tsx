import type { ReactNode } from 'react'

export function PageTitle({ children }: { readonly children: ReactNode }) {
  return <h1 className="text-xl font-bold">{children}</h1>
}

/** 白い面の区画。画面の中のまとまりを分ける。 */
export function Section({ children }: { readonly children: ReactNode }) {
  return <section className="flex flex-col gap-4 rounded-control border border-line bg-surface p-4">{children}</section>
}

/** 操作が済んだことを知らせる。 */
export function StatusMessage({ children }: { readonly children: ReactNode }) {
  return (
    <p role="status" className="rounded-control bg-notice px-3 py-2 text-sm">
      {children}
    </p>
  )
}

/** 項目に結びつかない失敗を知らせる。 */
export function AlertMessage({ children }: { readonly children: ReactNode }) {
  return (
    <p role="alert" className="rounded-control bg-warning px-3 py-2 text-sm text-danger">
      {children}
    </p>
  )
}
