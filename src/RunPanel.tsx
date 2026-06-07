interface OutputLine {
  id: bigint
  seq: bigint
  stream: string
  text: string
}

interface Props {
  outputs: readonly OutputLine[]
}

export function RunPanel({ outputs }: Props) {
  const sorted = [...outputs].sort((a, b) => Number(a.seq - b.seq))
  return (
    <div
      data-testid="run-panel"
      style={{ fontFamily: 'monospace', fontSize: 12, padding: '8px 12px', background: '#0d0d0d', height: '100%', overflowY: 'auto' }}
    >
      {sorted.length === 0
        ? <span style={{ opacity: 0.3 }}>No output yet. Click Run.</span>
        : sorted.map(o => (
          <div key={String(o.id)} style={{ color: o.stream === 'stderr' ? '#f87171' : '#e2e8f0', lineHeight: 1.6 }}>
            {o.text}
          </div>
        ))
      }
    </div>
  )
}
