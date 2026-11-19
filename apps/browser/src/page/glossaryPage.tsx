import { useState } from 'react'
import { Cell, HeaderCell, PageTitle, Section, Table } from '../component/part'
import { useModel } from '../model'
import { text } from '../text'

/** 業務の言葉（単語帳の業務の概念）。日本語・英語・名前のどれでも探せる。 */
export function GlossaryPage() {
  const { model } = useModel()
  const [query, setQuery] = useState('')
  const trimmedQuery = query.trim().toLowerCase()
  const entries = model.glossary.filter(
    (entry) =>
      trimmedQuery === '' ||
      [entry.japanese, entry.english, entry.id, entry.description].some((field) => field.toLowerCase().includes(trimmedQuery)),
  )

  return (
    <>
      <PageTitle>{text.label('glossary')}</PageTitle>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{text.label('search')}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          className="rounded-control border border-line bg-surface px-3 py-2"
        />
      </label>
      <Section title={`${text.label('glossary')}（${entries.length}）`}>
        <Table caption={text.label('glossary')}>
          <thead>
            <tr>
              <HeaderCell>{text.label('japanese')}</HeaderCell>
              <HeaderCell>{text.label('english')}</HeaderCell>
              <HeaderCell>{text.label('name')}</HeaderCell>
              <HeaderCell>{text.label('description')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <Cell>{entry.japanese}</Cell>
                <Cell>{entry.english}</Cell>
                <Cell>
                  <span className="font-mono text-xs">{entry.id}</span>
                </Cell>
                <Cell>{entry.description}</Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </>
  )
}
