import type { RoleNode, ScreenNode } from '@app/translator/model-types'
import { ScreenLink } from '../component/screenPart'
import { Cell, HeaderCell, PageTitle, Section, Table } from '../component/part'
import { useModel } from '../model'
import { useLabelFormat, useText } from '../text'

const sides: readonly RoleNode['side'][] = ['vendor', 'business', 'external']

/**
 * 画面遷移・レイアウト共通ルール（IPA 画面編）。静的解析で求められるものを出す。
 * 全体構造とナビゲーション（ナビゲーションの画面と、そこからたどる画面の木）・ユーザの定義（画面を操作する役割とその機能・画面）・配色と文字（style.css の @theme）・
 * エラー表示方法、エラーメッセージ（画面ごとの警告と知らせ）。
 */
export function ScreenRulePage() {
  const text = useText()
  const labelFormat = useLabelFormat()
  const { model } = useModel()
  const paletteTokens = model.styleTokens.filter((token) => token.name.startsWith('color-'))
  const typographyTokens = model.styleTokens.filter((token) => !token.name.startsWith('color-'))

  return (
    <>
      <PageTitle>{text.label('commonRule')}</PageTitle>
      <Section title={text.label('navigationStructure')}>
        <NavigationTree screens={model.screens} parentId={null} />
      </Section>
      <Section title={text.label('userDefinition')}>
        <Table caption={text.label('userDefinition')}>
          <thead>
            <tr>
              <HeaderCell>{text.label('role')}</HeaderCell>
              <HeaderCell>{text.label('side')}</HeaderCell>
              <HeaderCell>{text.label('feature')}</HeaderCell>
              <HeaderCell>{text.label('screen')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {sides.flatMap((side) =>
              model.roles
                .filter((role) => role.side === side && model.scenarios.some((scenario) => scenario.actor === role.id))
                .map((role) => {
                  const roleScenarios = model.scenarios.filter((scenario) => scenario.actor === role.id)
                  const screenIds = [...new Set(model.screens.filter((screen) => screen.scenarioIds.some((scenarioId) => roleScenarios.some((scenario) => scenario.id === scenarioId))).map((screen) => screen.id))]
                  return (
                    <tr key={role.id}>
                      <Cell>
                        <span className="whitespace-nowrap">{role.title}</span>
                      </Cell>
                      <Cell>
                        <span className="whitespace-nowrap">{role.sideTitle}</span>
                      </Cell>
                      <Cell>{labelFormat.joinList(roleScenarios.map((scenario) => scenario.title))}</Cell>
                      <Cell>
                        {screenIds.map((screenId) => (
                          <span key={screenId} className="mr-2 inline-block">
                            <ScreenLink screenId={screenId} />
                          </span>
                        ))}
                      </Cell>
                    </tr>
                  )
                }),
            )}
          </tbody>
        </Table>
      </Section>
      <Section title={text.label('palette')}>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {paletteTokens.map((token) => (
            <li key={token.name} className="flex items-center gap-2">
              <span className="inline-block h-5 w-8 rounded-control border border-line" style={{ background: token.value }} />
              <span className="font-mono text-xs">--{token.name}</span>
              <span className="font-mono text-xs text-muted">{token.value}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={text.label('typography')}>
        <ul className="flex flex-col gap-1 text-sm">
          {typographyTokens.map((token) => (
            <li key={token.name}>
              <span className="font-mono text-xs">--{token.name}</span>
              {labelFormat.mark}
              <span className="font-mono text-xs text-muted">{token.value}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={text.label('errorDisplay')}>
        <Table caption={text.label('errorDisplay')}>
          <thead>
            <tr>
              <HeaderCell>{text.label('screen')}</HeaderCell>
              <HeaderCell>{text.label('alert')}</HeaderCell>
              <HeaderCell>{text.label('feedback')}</HeaderCell>
              <HeaderCell>{text.label('inputConstraint')}</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {model.screens.map((screen) => (
              <tr key={screen.id}>
                <Cell>
                  <ScreenLink screenId={screen.id} />
                </Cell>
                <Cell>{labelFormat.joinList(screen.items.filter((item) => item.kind === 'alert').map((item) => item.label))}</Cell>
                <Cell>{labelFormat.joinList(screen.items.filter((item) => item.kind === 'status').map((item) => item.label))}</Cell>
                <Cell>{labelFormat.joinList(screen.items.flatMap((item) => item.constraints))}</Cell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </>
  )
}

/** 画面の木。ナビゲーションの画面（またはどこからもたどれない画面）を根にし、階層の1つ上の画面の下に並べる。 */
function NavigationTree({ screens, parentId }: { readonly screens: readonly ScreenNode[]; readonly parentId: string | null }) {
  const children = screens.filter((screen) => (parentId === null ? screen.hierarchy.length <= 1 : screen.hierarchy.at(-2) === parentId))
  if (children.length === 0) {
    return null
  }
  return (
    <ul className={`flex flex-col gap-1 text-sm ${parentId === null ? '' : 'mt-1 border-l border-line pl-4'}`}>
      {children.map((screen) => (
        <li key={screen.id}>
          <ScreenLink screenId={screen.id} />
          <NavigationTree screens={screens} parentId={screen.id} />
        </li>
      ))}
    </ul>
  )
}
