interface Props {
  title: string
  description: string
  example: string
}

export function QuestionPanel({ title, description, example }: Props) {
  return (
    <div
      data-testid="question-panel"
      style={{
        padding: '10px 14px',
        background: '#161616',
        borderBottom: '1px solid #1a1a1a',
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ opacity: 0.85 }}>{description}</div>
      <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12, opacity: 0.6 }}>
        Example: {example}
      </div>
    </div>
  )
}
