// 処理の訳（translateSource の結果）を Markdown にする。見出しの言葉は言語ごとに持つ。
import type { Locale } from '@app/vocabulary'
import type { FunctionTranslation, StepTranslation } from './translateSource'

export type FileTranslation = {
  readonly path: string
  readonly functions: readonly FunctionTranslation[]
}

const headings: Record<Locale, { readonly document: string; readonly generated: (source: string) => string; readonly name: string; readonly parameters: string; readonly steps: string; readonly separator: string }> = {
  ja: {
    document: '処理の日本語訳',
    generated: (source) => `生成物。\`pnpm translate\` で ${source} から作る。手で編集しない。`,
    name: '関数',
    parameters: '引数',
    steps: '処理',
    separator: '、',
  },
  en: {
    document: 'Processing in English',
    generated: (source) => `Generated. \`pnpm translate\` makes this from ${source}. Do not edit by hand.`,
    name: 'Function',
    parameters: 'Parameters',
    steps: 'Steps',
    separator: ', ',
  },
}

function renderSteps(steps: readonly StepTranslation[], depth: number): string[] {
  const indent = '   '.repeat(depth)
  return steps.flatMap((step, index) => [`${indent}${index + 1}. ${step.text}`, ...renderSteps(step.children, depth + 1)])
}

export function renderFunction(translation: FunctionTranslation, locale: Locale = 'ja'): string {
  const heading = headings[locale]
  const lines = [`### ${translation.title}`, '', `- ${heading.name}: \`${translation.name}\``]
  if (translation.parameters.length > 0) {
    lines.push(`- ${heading.parameters}: ${translation.parameters.join(heading.separator)}`)
  }
  if (translation.steps.length > 0) {
    lines.push(`- ${heading.steps}:`, '', ...renderSteps(translation.steps, 1))
  }
  return lines.join('\n')
}

export function renderMarkdown(files: readonly FileTranslation[], sourceDescription: string, locale: Locale = 'ja'): string {
  const heading = headings[locale]
  const sections = files
    .filter((file) => file.functions.length > 0)
    .map((file) => [`## ${file.path}`, '', ...file.functions.map((translation) => renderFunction(translation, locale)).flatMap((text) => [text, ''])].join('\n'))
  return [`# ${heading.document}`, '', `> ${heading.generated(sourceDescription)}`, '', ...sections].join('\n')
}
