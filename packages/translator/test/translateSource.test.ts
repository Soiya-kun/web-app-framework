import { describe, expect, test } from 'vitest'
import { renderFunction } from '../src/renderMarkdown'
import { translateSource } from '../src/translateSource'

describe('translateSource', () => {
  test('関数名を体言止めに、手順を「〜する」に訳す', () => {
    const [translation] = translateSource(
      `
      /** 輸送の実績を売上として計上するため。 */
      export async function createNewTransportSales(salesRepository: SalesRepository, salesRequest: SalesRequest) {
        const validatedRequest = validateSalesRequest(salesRequest)
        const transportSales = planTransportSales(validatedRequest)
        await salesRepository.create(transportSales)
        return transportSales
      }
      `,
      'createNewTransportSales.ts',
    )

    expect(translation).toBeDefined()
    expect(renderFunction(translation!)).toBe(
      [
        '### 新輸送売上の登録',
        '',
        '- 関数: `createNewTransportSales`',
        '- 目的: 輸送の実績を売上として計上するため。',
        '- 引数: 売上リポジトリ、売上リクエスト',
        '- 処理:',
        '',
        '   1. 売上リクエストをバリデーションする',
        '   2. 輸送売上を計画する',
        '   3. 売上を登録する',
        '   4. 輸送売上を返す',
      ].join('\n'),
    )
  })

  test('if・throw・前置詞を訳す', () => {
    const [translation] = translateSource(
      `
      export function interpretSalesAmount(text: string) {
        if (text === '') {
          throw rejectValue('inputRequired')
        }
        const customer = findCustomerById(text)
        return customer
      }
      `,
      'interpretSalesAmount.ts',
    )

    expect(translation?.title).toBe('売上金額の解釈')
    expect(translation?.steps).toEqual([
      { text: 'テキストが空である場合', children: [{ text: 'エラー「{field}を記入してください。」で止める', children: [] }] },
      { text: 'IDで顧客を取得する', children: [] },
      { text: '顧客を返す', children: [] },
    ])
  })
})
