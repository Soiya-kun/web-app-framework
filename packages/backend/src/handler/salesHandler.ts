import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import type { SalesRequest } from '../domain/sales/salesRequest'
import { createSales } from '../usecase/sales/createSales'
import type { AppDependency } from './dependency'
import { rejectInvalidRequest } from './requestValidation'

const salesRequestSchema = z.object({
  customerId: z.string(),
  salesDate: z.string(),
  salesKind: z.string(),
  itemName: z.string(),
  salesAmount: z.string(),
  taxRate: z.string(),
}) satisfies z.ZodType<SalesRequest>

export function prepareSalesHandler(dependency: AppDependency) {
  return new Hono().post('/', zValidator('json', salesRequestSchema, rejectInvalidRequest), async (context) => {
    const salesRequest = context.req.valid('json')
    const salesId = await dependency.runTransaction((repositories) =>
      createSales(repositories.salesRepository, repositories.customerRepository, dependency.idGenerator, salesRequest),
    )
    return context.json({ salesId }, 201)
  })
}
