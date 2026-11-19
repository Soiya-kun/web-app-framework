import { prepareText, type Locale, type Text } from '@app/vocabulary/text'
import { createContext, use, useMemo, type ReactNode } from 'react'

const TextContext = createContext<Text>(prepareText('ja'))

/** 画面の文言の言語を決める。文言はすべて単語帳から引く。 */
export function TextProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const text = useMemo(() => prepareText(locale), [locale])
  return <TextContext value={text}>{children}</TextContext>
}

export function useText(): Text {
  return use(TextContext)
}
