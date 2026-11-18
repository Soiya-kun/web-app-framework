import type { IdGenerator } from '../domain/shared/idGenerator'

/** テストで ID を予測できるよう、id-0001 から順に採番する。 */
export function prepareSequenceIdGenerator(): IdGenerator {
  let count = 0
  return {
    generate() {
      count += 1
      return `id-${String(count).padStart(4, '0')}`
    },
  }
}
