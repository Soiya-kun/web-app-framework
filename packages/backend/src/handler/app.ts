import { Hono } from 'hono'
import { prepareCustomerHandler } from './customerHandler'
import type { AppDependency } from './dependency'
import { respondError } from './errorHandler'
import { prepareInvoiceHandler } from './invoiceHandler'
import { prepareSalesHandler } from './salesHandler'

/** API 全体を組み立てる。部品（dependency）を変えるだけで、本番と画面の結合テストを切り替える。 */
export function prepareApp(dependency: AppDependency) {
  const app = new Hono()
    .basePath('/api')
    // ロードバランサーの死活監視。DB には触れない。
    .get('/health', (context) => context.json({ status: 'ok' }, 200))
    .route('/customers', prepareCustomerHandler(dependency))
    .route('/sales', prepareSalesHandler(dependency))
    .route('/invoices', prepareInvoiceHandler(dependency))
  app.onError(respondError)
  return app
}

export type AppType = ReturnType<typeof prepareApp>
