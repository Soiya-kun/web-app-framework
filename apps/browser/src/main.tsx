import type { Model } from '@app/translator/model-types'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import englishModel from '../generated/model.en.json'
import japaneseModel from '../generated/model.ja.json'
import { AppRoot } from './appRoot'
import { prepareRouter } from './router'
import './style.css'

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('id="root" の要素がありません。')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppRoot models={{ ja: japaneseModel as Model, en: englishModel as Model }} router={prepareRouter()} />
  </StrictMode>,
)
