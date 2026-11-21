// AI への指示は、文字起こしから議事録を作る Skill（.claude/skills/minutes）の1つだけにする。
// ほかの書き方の決まりは、型・lint・検査（CI）で止めるので、AI に向けた指示のファイルを増やさない。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ModelProblem } from './types'

export const skillRoot = '.claude/skills'
export const skillName = 'minutes'

/** AI に向けた指示を置く場所（Skill のほかは置かない）。 */
const instructionDirectories = ['.claude/commands', '.claude/agents', '.agents', '.codex', '.cursor', '.windsurf', '.github/instructions']
/** AI に向けた指示のファイルの名前。どのフォルダにも置かない。 */
const instructionFiles = new Set(['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', 'GEMINI.md', '.cursorrules', '.windsurfrules', 'copilot-instructions.md'])
const skippedDirectories = new Set(['node_modules', '.git', 'generated', 'dist'])

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** リポジトリの中の、AI に向けた指示のファイル。 */
function listInstructionFiles(root: string, directory: string): string[] {
  return readdirSync(join(root, directory))
    .sort()
    .flatMap((entry) => {
      const path = directory === '' ? entry : `${directory}/${entry}`
      if (isDirectory(join(root, path))) {
        return skippedDirectories.has(entry) ? [] : listInstructionFiles(root, path)
      }
      return instructionFiles.has(entry) ? [path] : []
    })
}

/** Skill が議事録を作るものの1つだけで、ほかに AI に向けた指示がないことを確かめる。 */
export function readSkillProblems(root: string, problems: ModelProblem[]): void {
  const skills = isDirectory(join(root, skillRoot)) ? readdirSync(join(root, skillRoot)).sort() : []
  if (skills.length !== 1 || skills[0] !== skillName) {
    problems.push({
      file: skillRoot,
      line: 1,
      rule: 'skill',
      message: `Skill は ${skillRoot}/${skillName}（文字起こしから議事録を作る）の1つだけにする。ほかの決まりは検査で止める（いま: ${skills.join('・') || 'なし'}）`,
    })
  }
  const skillFile = `${skillRoot}/${skillName}/SKILL.md`
  const frontmatter = (() => {
    try {
      return /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(root, skillFile), 'utf8'))?.[1] ?? ''
    } catch {
      return undefined
    }
  })()
  if (frontmatter === undefined) {
    problems.push({ file: skillFile, line: 1, rule: 'skill', message: `${skillFile} がない` })
  } else if (!new RegExp(`^name: ${skillName}$`, 'm').test(frontmatter) || !/^description: \S/m.test(frontmatter)) {
    problems.push({ file: skillFile, line: 1, rule: 'skill', message: `${skillFile} の先頭に name: ${skillName} と description を書く` })
  }
  for (const directory of instructionDirectories.filter((candidate) => isDirectory(join(root, candidate)))) {
    problems.push({ file: directory, line: 1, rule: 'skill', message: `AI に向けた指示（${directory}）は置かない。Skill は ${skillRoot}/${skillName} だけにし、ほかの決まりは検査で止める` })
  }
  for (const file of listInstructionFiles(root, '')) {
    problems.push({ file, line: 1, rule: 'skill', message: `AI に向けた指示のファイル（${file}）は置かない。Skill は ${skillRoot}/${skillName} だけにし、ほかの決まりは検査で止める` })
  }
}
