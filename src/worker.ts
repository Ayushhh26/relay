export interface WorkerRequest {
  code: string
  harness?: string
}

export interface WorkerResponse {
  logs: Array<{ stream: 'stdout' | 'stderr'; text: string }>
  error: string | null
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const logs: Array<{ stream: 'stdout' | 'stderr'; text: string }> = []

  const fakeConsole = {
    log: (...args: unknown[]) => logs.push({ stream: 'stdout', text: args.map(String).join(' ') }),
    error: (...args: unknown[]) => logs.push({ stream: 'stderr', text: args.map(String).join(' ') }),
    warn: (...args: unknown[]) => logs.push({ stream: 'stderr', text: '[warn] ' + args.map(String).join(' ') }),
  }

  let error: string | null = null
  const source = e.data.harness ? `${e.data.code}\n${e.data.harness}` : e.data.code

  try {
    // eslint-disable-next-line no-new-func
    new Function('console', source)(fakeConsole)
  } catch (err) {
    error = String(err)
  }

  self.postMessage({ logs, error } satisfies WorkerResponse)
}
