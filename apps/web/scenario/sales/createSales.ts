import { defineScenario } from '@app/flow'

/** 売上登録の画面に入れる値。選択肢は画面に出る名前で書く。 */
export type SalesInput = {
  readonly customer: string
  readonly salesDate: string
  readonly salesKind: string
  readonly itemName: string
  readonly salesAmount: string
  readonly taxRate: string
}

export const createSales = defineScenario('createSales', {
  actor: 'salesperson',
  operate: async (screen, sales: SalesInput) => {
    await screen.go('salesCreate')
    await screen.choose('customer', sales.customer)
    await screen.fill('salesDate', sales.salesDate)
    await screen.choose('salesKind', sales.salesKind)
    await screen.fill('itemName', sales.itemName)
    await screen.fill('salesAmount', sales.salesAmount)
    await screen.choose('taxRate', sales.taxRate)
    await screen.press('create')
  },
  confirm: async (screen) => {
    await screen.expectMessage('createCompleted')
  },
  extensions: {
    unselectedCustomer: { condition: '顧客を選んでいない' },
    invalidSalesDate: { condition: '売上日が空か、実在する日付でない' },
    invalidItemName: { condition: '品名が空か、100 文字を超える' },
    invalidSalesAmount: { condition: '売上金額が空か、1 から 999,999,999 の整数でない' },
    invalidFields: { condition: '問題のある項目が複数ある' },
  },
})
