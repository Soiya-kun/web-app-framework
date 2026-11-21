// 段の種類・ケースの種類の見出し。言語を切り替えたときに作り直せるよう、文言の表（Text）を受け取って作る。
import type { CaseNode, FlowStepNode, StepChange } from '@app/translator/model-types'
import type { Text } from '@app/vocabulary/text'

export function readStepKindLabels(text: Text): Readonly<Record<FlowStepNode['kind'], string>> {
  return {
    operate: text.label('screenOperation'),
    outside: text.label('outsideWork'),
    occur: text.label('externalEvent'),
    elapse: text.label('timeLapse'),
    nest: text.label('childFlow'),
    legacy: text.label('legacyOperation'),
  }
}

/** 現行の段の変わり方の見出し（同じ・置き換え・廃止）。 */
export function readStepChangeLabels(text: Text): Readonly<Record<StepChange, string>> {
  return {
    same: text.label('same'),
    replaced: text.label('replacement'),
    discontinued: text.label('discontinuation'),
  }
}

export function readCaseKindLabels(text: Text): Readonly<Record<CaseNode['kind'], string>> {
  return {
    main: text.label('primarySuccessScenario'),
    vary: text.label('variation'),
    extend: text.label('extension'),
  }
}
