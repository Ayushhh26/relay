self.onmessage = (e: MessageEvent<{ code: string }>) => {
  const logs: Array<{ stream: 'stdout' | 'stderr'; text: string }> = []

  const fakeConsole = {
    log: (...args: unknown[]) => logs.push({ stream: 'stdout', text: args.map(String).join(' ') }),
    error: (...args: unknown[]) => logs.push({ stream: 'stderr', text: args.map(String).join(' ') }),
    warn: (...args: unknown[]) => logs.push({ stream: 'stderr', text: '[warn] ' + args.map(String).join(' ') }),
  }

  let error: string | null = null
  try {
    // eslint-disable-next-line no-new-func
    new Function('console', e.data.code)(fakeConsole)
  } catch (err) {
    error = String(err)
  }

  self.postMessage({ logs, error })
}
