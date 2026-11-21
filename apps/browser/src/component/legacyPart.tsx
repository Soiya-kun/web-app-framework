// 現行の業務フローの部品。段の変わり方の印、置き換え先へのリンク、変わり方の数。
import type { LegacyFlowNode, ReplacementNode, StepChange } from '@app/translator/model-types'
import { useLabelFormat, useText } from '../text'
import { readStepChangeLabels } from './kindLabel'
import { Badge, TextLink } from './part'

const changeTones: Readonly<Record<StepChange, 'plain' | 'primary' | 'pending'>> = { same: 'plain', replaced: 'primary', discontinued: 'pending' }

/** 段の変わり方の印（同じ・置き換え・廃止）。 */
export function ChangeBadge({ change }: { readonly change: StepChange }) {
  const text = useText()
  return <Badge tone={changeTones[change]}>{readStepChangeLabels(text)[change]}</Badge>
}

/** 置き換え先へのリンク（シナリオ・業務フローはそのページ、システムの外の業務は名前だけ）。 */
export function ReplacementLink({ replacement }: { readonly replacement: ReplacementNode }) {
  if (replacement.kind === 'scenario') {
    return (
      <TextLink to="/scenario/$scenarioId" params={{ scenarioId: replacement.id }}>
        {replacement.title}
      </TextLink>
    )
  }
  if (replacement.kind === 'flow') {
    return (
      <TextLink to="/flow/$flowId" params={{ flowId: replacement.id }}>
        {replacement.title}
      </TextLink>
    )
  }
  return <>{replacement.title}</>
}

export function ReplacementList({ list }: { readonly list: readonly ReplacementNode[] }) {
  const labelFormat = useLabelFormat()
  return (
    <>
      {list.map((replacement, index) => (
        <span key={`${replacement.kind}-${replacement.id}`}>
          {index === 0 ? null : labelFormat.mark}
          <ReplacementLink replacement={replacement} />
        </span>
      ))}
    </>
  )
}

/** 変わり方ごとの段の数と、新しい段の数（「同じ 3・置き換え 4・廃止 1・新しい段 2」）。 */
export function readChangeSummary(legacy: LegacyFlowNode, labels: Readonly<Record<StepChange | 'newStep', string>>, mark: string): string {
  const sumChange = (change: StepChange) => legacy.steps.filter((step) => step.change === change).length
  return [
    `${labels.same} ${sumChange('same')}`,
    `${labels.replaced} ${sumChange('replaced')}`,
    `${labels.discontinued} ${sumChange('discontinued')}`,
    `${labels.newStep} ${legacy.addedSteps.length}`,
  ].join(mark)
}

/** 変わり方の数の見出し（言語に合わせる）。 */
export function useChangeSummary(): (legacy: LegacyFlowNode) => string {
  const text = useText()
  const labelFormat = useLabelFormat()
  const labels = { ...readStepChangeLabels(text), newStep: text.label('newStep') }
  return (legacy) => readChangeSummary(legacy, labels, labelFormat.mark)
}
