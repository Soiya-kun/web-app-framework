// キャンバスで使う小さな印（SVG）。色は文字の色（currentColor）に合わせる。

export function ChevronIcon({ opened }: { readonly opened: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-3.5 shrink-0 transition-transform duration-150 ${opened ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function MinusIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path d="M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function FitIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path
        d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
