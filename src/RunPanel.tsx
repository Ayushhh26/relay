import type { CSSProperties } from 'react'

interface OutputLine {
  id: bigint
  seq: bigint
  stream: string
  text: string
}

interface Props {
  outputs: readonly OutputLine[]
  isRunning?: boolean
}

export function RunPanel({ outputs, isRunning = false }: Props) {
  const sorted = [...outputs].sort((a, b) => Number(a.seq - b.seq))

  return (
    <div data-testid="run-panel" style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.prompt}>&gt;_</span>
        <span style={styles.title}>Terminal</span>
        {isRunning && <span style={styles.running}>Running…</span>}
      </div>
      <div style={styles.body}>
        {sorted.length === 0 && !isRunning ? (
          <span style={styles.empty}>No output yet. Click Run.</span>
        ) : (
          sorted.map(o => (
            <div
              key={String(o.id)}
              style={{
                ...styles.line,
                color: o.stream === 'stderr' ? '#f87171' : '#e2e8f0',
              }}
            >
              {o.text}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#050505',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    borderBottom: '1px solid #141414',
    background: '#0a0a0a',
  },
  prompt: {
    color: '#22c55e',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 700,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: '#94a3b8',
  },
  running: {
    marginLeft: 'auto',
    fontSize: 11,
    color: '#60a5fa',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 12px',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  empty: {
    opacity: 0.35,
  },
  line: {
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
}
