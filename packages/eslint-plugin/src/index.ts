import { flatSteps } from './flatSteps'
import { knownFileName } from './knownFileName'
import { knownPath } from './knownPath'
import { knownWords } from './knownWords'
import { verbFirst } from './verbFirst'

const plugin = {
  meta: { name: '@app/eslint-plugin' },
  rules: {
    'known-words': knownWords,
    'known-file-name': knownFileName,
    'known-path': knownPath,
    'verb-first': verbFirst,
    'flat-steps': flatSteps,
  },
}

export default plugin
