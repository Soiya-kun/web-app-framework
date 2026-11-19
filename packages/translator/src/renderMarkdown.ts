import type { FunctionTranslation, StepTranslation } from './translateSource'

export type FileTranslation = {
  readonly path: string
  readonly functions: readonly FunctionTranslation[]
}

function renderSteps(steps: readonly StepTranslation[], depth: number): string[] {
  const indent = '   '.repeat(depth)
  return steps.flatMap((step, index) => [`${indent}${index + 1}. ${step.text}`, ...renderSteps(step.children, depth + 1)])
}

export function renderFunction(translation: FunctionTranslation): string {
  const lines = [`### ${translation.title}`, '', `- 関数: \`${translation.name}\``]
  if (translation.parameters.length > 0) {
    lines.push(`- 引数: ${translation.parameters.join('、')}`)
  }
  if (translation.steps.length > 0) {
    lines.push('- 処理:', '', ...renderSteps(translation.steps, 1))
  }
  return lines.join('\n')
}

export function renderMarkdown(files: readonly FileTranslation[], sourceDescription: string): string {
  const sections = files
    .filter((file) => file.functions.length > 0)
    .map((file) => [`## ${file.path}`, '', ...file.functions.map(renderFunction).flatMap((text) => [text, ''])].join('\n'))
  return [
    '# 処理の日本語訳',
    '',
    `> 生成物。\`pnpm translate\` で ${sourceDescription} から作る。手で編集しない。`,
    '',
    ...sections,
  ].join('\n')
}
