// モック（pnpm dev:mock）で業務フローの段を開くリンク。モックの開発パネルが、事前条件のデータからその段の手前まで流して、段の画面を開く。
// モックの URL は VITE_MOCK_ORIGIN で変えられる（モックが 5173 番以外で起動したとき）。
import { useText } from '../text'

const mockOrigin = (import.meta.env['VITE_MOCK_ORIGIN'] as string | undefined) ?? 'http://localhost:5173'

/** 段の番号から、モックの開発パネルが開く URL を作る。拡張の中の段（4a.1）なら、その拡張の経路（4a）で開く。 */
export function composeMockUrl(flowId: string, number: string): string {
  const courseKey = /^([\d.]*\d[a-z])/.exec(number)?.[1]
  const query = new URLSearchParams({ 'mock-flow': flowId, 'mock-step': number })
  if (courseKey !== undefined) {
    query.set('mock-path', courseKey)
  }
  return `${mockOrigin}/?${query.toString()}`
}

export function MockLink({ flowId, number }: { readonly flowId: string; readonly number: string }) {
  const text = useText()
  return (
    <a href={composeMockUrl(flowId, number)} target="mock" rel="noreferrer" title={text.message('mockGuide')} className="text-xs text-primary underline underline-offset-2">
      {text.message('openMock')}
    </a>
  )
}
