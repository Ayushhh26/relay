import type { RunOutput } from './module_bindings/types'

export interface StudyAssistPayload {
  prompt: string
  policy: string
  roomKind: string
  code: string
  runOutput: string
  role: string
  roomTitle: string
}

export function formatRunOutput(rows: RunOutput[]): string {
  return [...rows]
    .sort((a, b) => Number(a.seq - b.seq))
    .map(r => r.text)
    .join('\n')
}
