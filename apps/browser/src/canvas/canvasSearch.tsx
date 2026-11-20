// キャンバスの上で名前を探す（Ctrl（⌘）＋K）。業務フロー・シナリオ・処理を選ぶと、その段のカードを開いて寄せる。
import { useState, type KeyboardEvent, type Ref } from 'react'
import { useModel } from '../model'
import { useText, useLabelFormat } from '../text'

export type SearchTarget =
  | { readonly kind: 'flow'; readonly flowId: string }
  | { readonly kind: 'scenario'; readonly scenarioId: string }
  | { readonly kind: 'work'; readonly workId: string }

type SearchResult = { readonly key: string; readonly title: string; readonly kindTitle: string; readonly target: SearchTarget }

const resultLimit = 8

export function CanvasSearch({
  attachInput,
  onSelect,
}: {
  readonly attachInput: Ref<HTMLInputElement>
  readonly onSelect: (target: SearchTarget) => void
}) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { model } = useModel()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const trimmedQuery = query.trim().toLowerCase()
  const results: readonly SearchResult[] =
    trimmedQuery === ''
      ? []
      : [
          ...model.flows.map((flow) => ({
            key: `flow:${flow.id}`,
            title: flow.title,
            kindTitle: text.label('flow'),
            target: { kind: 'flow', flowId: flow.id } as const,
          })),
          ...model.scenarios.map((scenario) => ({
            key: `scenario:${scenario.id}`,
            title: scenario.title,
            kindTitle: text.label('scenario'),
            target: { kind: 'scenario', scenarioId: scenario.id } as const,
          })),
          ...model.works.map((work) => ({
            key: `work:${work.id}`,
            title: work.title,
            kindTitle: text.label('work'),
            target: { kind: 'work', workId: work.id } as const,
          })),
        ]
          .filter((result) => result.title.toLowerCase().includes(trimmedQuery) || result.key.toLowerCase().includes(trimmedQuery))
          .slice(0, resultLimit)
  const selectResult = (result: SearchResult | undefined) => {
    if (result === undefined) {
      return
    }
    onSelect(result.target)
    setQuery('')
    setActiveIndex(0)
  }
  const pressKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => Math.min(results.length - 1, current + 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => Math.max(0, current - 1))
    }
    if (event.key === 'Enter') {
      selectResult(results[activeIndex])
    }
    if (event.key === 'Escape') {
      setQuery('')
    }
  }

  return (
    <div className="relative">
      <input
        ref={attachInput}
        role="combobox"
        aria-label={text.label('search')}
        aria-expanded={results.length > 0}
        aria-controls="canvas-search-result"
        value={query}
        onChange={(event) => {
          setQuery(event.currentTarget.value)
          setActiveIndex(0)
        }}
        onKeyDown={pressKey}
        placeholder={labelFormat.joinNote(text.label('search'), 'Ctrl+K')}
        className="w-64 rounded-lg border border-line/70 bg-canvas px-3 py-1.5 text-sm outline-none focus:border-select focus:bg-surface"
      />
      {results.length === 0 ? null : (
        <ul
          id="canvas-search-result"
          role="listbox"
          aria-label={text.label('searchResult')}
          className="absolute left-0 top-full mt-1 w-80 rounded-xl bg-surface p-1 shadow-[var(--shadow-float)]"
        >
          {results.map((result, index) => (
            <li
              key={result.key}
              role="option"
              aria-selected={index === activeIndex}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => selectResult(result)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${index === activeIndex ? 'bg-select/10' : 'hover:bg-canvas'}`}
            >
              <span className="rounded bg-canvas px-1.5 text-[10px] font-medium text-muted">{result.kindTitle}</span>
              {result.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
