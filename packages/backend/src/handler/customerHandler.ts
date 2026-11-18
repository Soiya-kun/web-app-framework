import { Hono } from 'hono'
import { listCustomers } from '../usecase/customer/listCustomers'
import type { AppDependency } from './dependency'

export function prepareCustomerHandler(dependency: AppDependency) {
  return new Hono().get('/', async (context) => {
    const customers = await dependency.runTransaction((repositories) => listCustomers(repositories.customerRepository))
    return context.json({ customers }, 200)
  })
}
