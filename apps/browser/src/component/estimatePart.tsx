// 見積の部品。金額の表示と、業務フロー・シナリオ・現行の業務フロー・処理のページに出す、そこを指す見積の項目。
import type { EstimateItemNode } from '@app/translator/model-types'
import { useModel } from '../model'
import { useLabelFormat, useLocale, useText } from '../text'
import type { PlaceMatch } from './meetingPart'
import { Section, TextLink } from './part'

/** 金額（円）を、今の言語の形にする。 */
export function useYenFormat(): (amount: number) => string {
  const { locale } = useLocale()
  const format = new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { style: 'currency', currency: 'JPY' })
  return (amount) => format.format(amount)
}

/** いちばん新しい見積の項目のうち、その場所を指すもの。 */
export function PlaceEstimate({ matchPlace }: { readonly matchPlace: PlaceMatch }) {
  const text = useText()
  const labelFormat = useLabelFormat()
  const formatYen = useYenFormat()
  const { model } = useModel()
  const latest = model.estimates.at(-1)
  const items: readonly EstimateItemNode[] = latest === undefined ? [] : latest.items.filter((item) => item.targets.some(matchPlace))
  if (latest === undefined || items.length === 0) {
    return null
  }
  return (
    <Section title={labelFormat.joinNote(text.label('estimate'), formatYen(items.reduce((sum, item) => sum + item.amount, 0)))}>
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((item) => (
          <li key={item.title} className="flex flex-wrap items-baseline gap-x-2">
            <span>{item.title}</span>
            <span className="tabular-nums">{formatYen(item.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        <TextLink to="/estimate/$estimateId" params={{ estimateId: latest.id }}>
          {labelFormat.joinNote(latest.title, latest.date)}
        </TextLink>
      </p>
    </Section>
  )
}
