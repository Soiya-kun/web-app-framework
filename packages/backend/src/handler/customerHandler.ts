import { Hono } from 'hono'
import { listCustomers } from '../usecase/customer/listCustomers'
import type { AppDependency } from './dependency'

export function prepareCustomerHandler(dependency: AppDependency) {
  return new Hono().get('/', async (context) => {
    const customers = await listCustomers(dependency.customerRepository)
    return context.json({ customers }, 200)
  })
}
