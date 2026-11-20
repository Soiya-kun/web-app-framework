import { RuleTester } from '@typescript-eslint/rule-tester'
import { afterAll, describe, it } from 'vitest'
import { flatSteps } from '../src/flatSteps'
import { knownFileName } from '../src/knownFileName'
import { knownPath } from '../src/knownPath'
import { knownWords } from '../src/knownWords'
import { verbFirst } from '../src/verbFirst'

RuleTester.afterAll = afterAll
RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const ruleTester = new RuleTester()

ruleTester.run('known-words', knownWords, {
  valid: [
    'function createSales(salesRequest: SalesRequest): void {}',
    "import { useState } from 'react'",
    'const salesRow = { queryKey: [], refetchOnWindowFocus: false }',
    'type SalesRow = { readonly salesId: string }',
    "declare module 'library' { interface Register { router: string } }",
  ],
  invalid: [
    { code: 'function addSales(): void {}', errors: [{ messageId: 'avoidedWord' }] },
    { code: 'const foo = 1', errors: [{ messageId: 'unknownWord' }] },
    { code: 'type SalesRow = { readonly salesFoo: string }', errors: [{ messageId: 'unknownWord' }] },
    { code: "import { useState as useFoo } from 'react'", errors: [{ messageId: 'unknownWord' }] },
  ],
})

ruleTester.run('known-file-name', knownFileName, {
  valid: [
    { code: 'export {}', filename: 'apps/web/src/invoice/invoiceDetailPage.tsx' },
    { code: 'export {}', filename: 'packages/backend/test/repository/postgresRepository.database.test.ts' },
    { code: 'export {}', filename: 'apps/web/e2e/flow.e2e.test.ts' },
    { code: 'export {}', filename: 'apps/web/e2e/browserSetup.ts' },
  ],
  invalid: [
    { code: 'export {}', filename: 'apps/web/src/invoice/invoiceHelper.ts', errors: [{ messageId: 'unknownWord', data: { word: 'helper', part: 'invoiceHelper' } }] },
    { code: 'export {}', filename: 'apps/web/test/salesFoo.test.ts', errors: [{ messageId: 'unknownWord' }] },
  ],
})

ruleTester.run('known-path', knownPath, {
  valid: [
    "app.basePath('/api').route('/invoices', invoiceHandler)",
    "new Hono().post('/:invoiceId/issue', handler)",
    "createRoute({ path: '/invoices/$invoiceId' })",
    "const value = salesMap.get('salesId')",
  ],
  invalid: [
    { code: "new Hono().get('/:invoiceFoo', handler)", errors: [{ messageId: 'unknownWord', data: { word: 'foo', path: '/:invoiceFoo' } }] },
    { code: "createRoute({ path: '/sales/helper' })", errors: [{ messageId: 'unknownWord' }] },
  ],
})

ruleTester.run('verb-first', verbFirst, {
  valid: ['function createSales(): void {}', 'function SalesCreatePage() { return null }', 'const listCustomers = () => []'],
  invalid: [
    { code: 'function salesList(): void {}', errors: [{ messageId: 'verbRequired' }] },
    { code: 'const salesList = () => []', errors: [{ messageId: 'verbRequired' }] },
  ],
})

const usecaseHeader = 'declare const salesRepository: { createSales(value: unknown): Promise<void> }\n'

ruleTester.run('flat-steps', flatSteps, {
  valid: [
    `export async function createSales(salesRepository, customerRepository, idGenerator, salesRequest) {
      const { customerId, salesDate, salesAmount } = interpretSalesRequest(salesRequest)
      const customer = await customerRepository.findCustomer(customerId)
      const salesId = assignSalesId(idGenerator)
      const salesCreate = planSalesCreate(salesId, customer, salesDate, salesAmount)
      await salesRepository.createSales(salesCreate)
      return salesId
    }`,
    `export async function createSales(dependency, salesRequest) {
      const salesInput = interpretSalesRequest(salesRequest)
      const customer = await dependency.customerRepository.findCustomer(salesInput.customerId)
      return customer.customerId
    }`,
  ],
  invalid: [
    {
      code: `${usecaseHeader}export function createSales(sales) { if (sales) { planSales(sales) } }`,
      errors: [{ messageId: 'statementNotAllowed' }],
    },
    {
      code: 'export function listSales(salesList) { const amounts = salesList.filter(isValid).map(readAmount); return amounts }',
      errors: [{ messageId: 'methodChain' }],
    },
    {
      code: 'export function listSales(salesRepository) { const salesList = salesRepository.listSales().all(); return salesList }',
      errors: [{ messageId: 'methodChain' }],
    },
    {
      code: "export function createSales(sales) { planSales(sales, 'draft') }",
      errors: [{ messageId: 'argumentNotAllowed' }],
    },
    {
      code: 'export function createSales(sales) { let draft = planSales(sales); return draft }',
      errors: [{ messageId: 'declarationNotAllowed' }],
    },
    {
      code: 'export function createSales(sales) { const total = sales + sales; return total }',
      errors: [{ messageId: 'callRequired' }],
    },
    {
      code: 'export function createSales(sales) { throw sales }',
      errors: [{ messageId: 'statementNotAllowed' }],
    },
    {
      code: 'export function createSales(sales) { const draft = planSales(sales); return { draft } }',
      errors: [{ messageId: 'returnNotAllowed' }],
    },
  ],
})
