import type { Model } from '@app/translator/model-types'
import { RouterProvider } from '@tanstack/react-router'
import { ModelProvider } from './model'
import type { prepareRouter } from './router'

export function AppRoot({ model, router }: { readonly model: Model; readonly router: ReturnType<typeof prepareRouter> }) {
  return (
    <ModelProvider model={model}>
      <RouterProvider router={router} />
    </ModelProvider>
  )
}
