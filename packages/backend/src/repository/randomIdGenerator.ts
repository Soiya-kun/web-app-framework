import type { IdGenerator } from '../domain/shared/idGenerator'

/** 本番用。UUID で採番する。 */
export function prepareRandomIdGenerator(): IdGenerator {
  return {
    generate() {
      return crypto.randomUUID()
    },
  }
}
