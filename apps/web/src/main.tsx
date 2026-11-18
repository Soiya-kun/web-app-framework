import { QueryClient } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { prepareApiClient } from './shared/apiClient'
import { AppRoot } from './shared/appRoot'
import { prepareRouter } from './shared/router'
import './style.css'

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('id="root" の要素がありません。')
}

const apiClient = prepareApiClient(window.location.origin)
const queryClient = new QueryClient()

createRoot(rootElement).render(
  <StrictMode>
    <AppRoot apiClient={apiClient} queryClient={queryClient} router={prepareRouter({ apiClient, queryClient })} locale="ja" />
  </StrictMode>,
)
