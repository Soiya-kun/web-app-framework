import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import type { ClosingRequest } from '../domain/invoice/closingRequest'
import { cancelClosing } from '../usecase/invoice/cancelClosing'
import { closeInvoice } from '../usecase/invoice/closeInvoice'
import { findInvoiceDetail } from '../usecase/invoice/findInvoiceDetail'
import { issueInvoice } from '../usecase/invoice/issueInvoice'
import { listInvoices } from '../usecase/invoice/listInvoices'
import type { AppDependency } from './dependency'
import { rejectInvalidRequest } from './requestValidation'

const closingRequestSchema = z.object({
  billingCustomerId: z.string(),
  closingDate: z.string(),
}) satisfies z.ZodType<ClosingRequest>

const issueBodySchema = z.object({
  issueDate: z.string(),
})

export function prepareInvoiceHandler(dependency: AppDependency) {
  return new Hono()
    .get('/', async (context) => {
      const invoices = await dependency.runTransaction((repositories) => listInvoices(repositories))
      return context.json({ invoices }, 200)
    })
    .post('/', zValidator('json', closingRequestSchema, rejectInvalidRequest), async (context) => {
      const closingRequest = context.req.valid('json')
      const invoiceId = await dependency.runTransaction((repositories) =>
        closeInvoice(repositories, dependency.idGenerator, closingRequest),
      )
      return context.json({ invoiceId }, 201)
    })
    .get('/:invoiceId', async (context) => {
      const invoiceDetail = await dependency.runTransaction((repositories) =>
        findInvoiceDetail(repositories, context.req.param('invoiceId')),
      )
      return context.json({ invoiceDetail }, 200)
    })
    .post('/:invoiceId/issue', zValidator('json', issueBodySchema, rejectInvalidRequest), async (context) => {
      const issueBody = context.req.valid('json')
      const invoiceNumber = await dependency.runTransaction((repositories) =>
        issueInvoice(repositories, { invoiceId: context.req.param('invoiceId'), issueDate: issueBody.issueDate }),
      )
      return context.json({ invoiceNumber }, 200)
    })
    .delete('/:invoiceId', async (context) => {
      await dependency.runTransaction((repositories) => cancelClosing(repositories, context.req.param('invoiceId')))
      return context.body(null, 204)
    })
}
