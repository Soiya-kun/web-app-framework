import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import type { PaymentRequest } from '../domain/payment/paymentRequest'
import { identifyPayment } from '../usecase/payment/identifyPayment'
import { listPayments } from '../usecase/payment/listPayments'
import { registerPayment } from '../usecase/payment/registerPayment'
import type { AppDependency } from './dependency'
import { rejectInvalidRequest } from './requestValidation'

const paymentRequestSchema = z.object({
  paymentDate: z.string(),
  paymentMethod: z.string(),
  paymentAmount: z.string(),
  payerName: z.string(),
  customerId: z.string(),
}) satisfies z.ZodType<PaymentRequest>

const identifyBodySchema = z.object({
  customerId: z.string(),
})

export function preparePaymentHandler(dependency: AppDependency) {
  return new Hono()
    .get('/', async (context) => {
      const payments = await dependency.runTransaction((repositories) => listPayments(repositories))
      return context.json({ payments }, 200)
    })
    .post('/', zValidator('json', paymentRequestSchema, rejectInvalidRequest), async (context) => {
      const paymentRequest = context.req.valid('json')
      const paymentCreate = await dependency.runTransaction((repositories) =>
        registerPayment(repositories, dependency.idGenerator, paymentRequest),
      )
      return context.json({ paymentId: paymentCreate.paymentId, customerId: paymentCreate.customerId }, 201)
    })
    .post('/:paymentId/identify', zValidator('json', identifyBodySchema, rejectInvalidRequest), async (context) => {
      const identifyBody = context.req.valid('json')
      await dependency.runTransaction((repositories) =>
        identifyPayment(repositories, { paymentId: context.req.param('paymentId'), customerId: identifyBody.customerId }),
      )
      return context.body(null, 204)
    })
}
