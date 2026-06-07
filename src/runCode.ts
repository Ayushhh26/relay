import type { WorkerResponse } from './worker'
import type { CodeLanguage } from './languages'

let pyodidePromise: Promise<import('pyodide').PyodideInterface> | null = null

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const { loadPyodide } = await import('pyodide')
      return loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
      })
    })()
  }
  return pyodidePromise
}

function runJavaScript(code: string, harness?: string): Promise<WorkerResponse> {
  return new Promise(resolve => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      resolve(e.data)
      worker.terminate()
    }
    worker.onerror = err => {
      resolve({ logs: [], error: String(err.message ?? err) })
      worker.terminate()
    }
    worker.postMessage({ code, harness })
  })
}

async function runPython(code: string, harness?: string): Promise<WorkerResponse> {
  const pyodide = await getPyodide()
  const source = harness ? `${code}\n${harness}` : code

  const runner = `
import sys
from io import StringIO

_stdout = StringIO()
_old_out, _old_err = sys.stdout, sys.stderr
sys.stdout = sys.stderr = _stdout
_error = None

try:
    exec(${JSON.stringify(source)}, {"__name__": "__main__"})
except Exception as e:
    _error = f"{type(e).__name__}: {e}"
finally:
    sys.stdout, sys.stderr = _old_out, _old_err

(_stdout.getvalue(), _error)
`

  try {
    const [output, error] = await pyodide.runPythonAsync(runner) as [string, string | null]
    const logs: WorkerResponse['logs'] = []
    const text = String(output ?? '')
    if (text) {
      const lines = text.replace(/\r\n/g, '\n').split('\n')
      for (const line of lines) {
        if (line.length > 0) logs.push({ stream: 'stdout', text: line })
      }
    }
    return { logs, error: error ?? null }
  } catch (err) {
    return { logs: [], error: String(err) }
  }
}

export async function runCode(
  language: CodeLanguage,
  code: string,
  harness?: string,
): Promise<WorkerResponse> {
  if (language === 'python') return runPython(code, harness)
  return runJavaScript(code, harness)
}
