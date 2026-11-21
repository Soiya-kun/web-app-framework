import type { StepTranslationNode } from '@app/translator/model-types'
import { getRouteApi } from '@tanstack/react-router'
import { PlaceMinutes, prepareWorkMatch } from '../component/meetingPart'
import { Badge, PageTitle, Section, SourcePlace, TextLink } from '../component/part'
import { useModel } from '../model'
import { useText, useLabelFormat } from '../text'

const workRoute = getRouteApi('/work/$workId')

/** 処理の手順の木（if の中は入れ子）。 */
export function StepTree({ label, steps }: { readonly label: string; readonly steps: readonly StepTranslationNode[] }) {
  return (
    <ol aria-label={label} className="flex list-decimal flex-col gap-1 pl-6 text-sm">
      {steps.map((step, index) => (
        <li key={index}>
          {step.text}
          {step.children.length === 0 ? null : <StepTree label={step.text} steps={step.children} />}
        </li>
      ))}
    </ol>
  )
}

export function WorkPage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { workId } = workRoute.useParams()
  const { model, works, rules } = useModel()
  const work = works.get(workId)
  if (work === undefined) {
    return <PageTitle>{text.message('missingTarget')}</PageTitle>
  }
  const usingScenarios = model.scenarios.filter((scenario) => scenario.workIds.includes(work.id))

  return (
    <>
      <PageTitle level={labelFormat.joinNote(text.label('subfunction'), text.label('work'))}>{work.title}</PageTitle>
      <p className="font-mono text-xs">{work.id}</p>
      <SourcePlace file={work.file} line={work.line} />
      <Section title={text.label('step')}>
        <StepTree label={labelFormat.joinItem(work.title, text.label('step'))} steps={work.steps} />
      </Section>
      <Section title={text.label('rule')}>
        <ul className="flex flex-col gap-2 text-sm">
          {work.ruleIds.map((ruleId) => {
            const rule = rules.get(ruleId)
            return rule === undefined ? null : (
              <li key={ruleId} className="flex flex-col gap-1">
                <details>
                  <summary className="cursor-pointer">
                    <span className="font-medium">{rule.title}</span> <span className="font-mono text-xs text-muted">{rule.name}</span>
                  </summary>
                  <div className="flex flex-col gap-1 pt-2">
                    <StepTree label={rule.title} steps={rule.steps} />
                    <SourcePlace file={rule.file} line={rule.line} />
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </Section>
      <Section title={text.label('repository')}>
        <ul className="flex flex-col gap-1 text-sm">
          {work.repositoryCalls.map((call) => (
            <li key={`${call.repository}.${call.method}`}>
              {call.title}{' '}
              {call.statementIds.map((statementId) => (
                <span key={statementId} className="mr-1">
                  <Badge>
                    <TextLink to="/statement/$statementId" params={{ statementId }}>
                      {statementId}
                    </TextLink>
                  </Badge>
                </span>
              ))}
            </li>
          ))}
        </ul>
      </Section>
      <div className="grid gap-5 md:grid-cols-2">
        <Section title={text.label('endpoint')}>
          <ul className="font-mono text-xs">
            {work.endpointIds.map((endpointId) => (
              <li key={endpointId}>{endpointId}</li>
            ))}
          </ul>
        </Section>
        <Section title={text.label('scenario')}>
          <ul className="text-sm">
            {usingScenarios.map((scenario) => (
              <li key={scenario.id}>
                <TextLink to="/scenario/$scenarioId" params={{ scenarioId: scenario.id }}>
                  {scenario.title}
                </TextLink>
              </li>
            ))}
          </ul>
        </Section>
      </div>
      <PlaceMinutes matchPlace={prepareWorkMatch(work)} />
    </>
  )
}
