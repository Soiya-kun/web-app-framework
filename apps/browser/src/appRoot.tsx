import type { Model } from '@app/translator/model-types'
import type { Locale } from '@app/vocabulary'
import { RouterProvider } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { ModelProvider } from './model'
import type { prepareRouter } from './router'
import { LocaleContext, prepareLocaleState, readSavedLocale, saveLocale } from './text'

/** 言語ごとのモデル（同じ解析から、見出し・手順を日本語と英語で作ったもの）。 */
export type LocaleModels = Readonly<Record<Locale, Model>>

export function AppRoot({ models, router }: { readonly models: LocaleModels; readonly router: ReturnType<typeof prepareRouter> }) {
  const [locale, setLocale] = useState<Locale>(readSavedLocale)
  const selectLocale = useCallback((next: Locale) => {
    setLocale(next)
    saveLocale(next)
  }, [])
  const localeState = useMemo(() => prepareLocaleState(locale, selectLocale), [locale, selectLocale])
  return (
    <LocaleContext value={localeState}>
      <ModelProvider model={models[locale]}>
        <RouterProvider router={router} />
      </ModelProvider>
    </LocaleContext>
  )
}
