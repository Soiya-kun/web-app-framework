import { flatSteps } from './flatSteps'
import { knownWords } from './knownWords'
import { verbFirst } from './verbFirst'

const plugin = {
  meta: { name: '@app/eslint-plugin' },
  rules: {
    'known-words': knownWords,
    'verb-first': verbFirst,
    'flat-steps': flatSteps,
  },
}

export default plugin
