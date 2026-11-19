// 業務フローを、経路（本線と拡張）ごとの E2E としてインプロセスで流す。flow の下の業務フローは、すべてここで流れる。
import type { Flow } from '@app/flow'
import { describeFlow } from '@app/flow/vitest'
import type { MemoryDatabase } from '@app/backend/testing'
import { launchApp } from '../test/launchApp'

const flowFiles = import.meta.glob<Readonly<Record<string, unknown>>>(['./*.ts', '!./*.test.ts'], { eager: true })

function isFlow(value: unknown): value is Flow<Partial<MemoryDatabase>> {
  return typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'flow'
}

for (const flowFile of Object.values(flowFiles)) {
  for (const flow of Object.values(flowFile).filter(isFlow)) {
    describeFlow(flow, (seed) => launchApp(seed))
  }
}
