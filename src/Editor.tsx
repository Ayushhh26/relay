interface Props {
  value: string
  onChange?: (val: string) => void
  readOnly?: boolean
}

export function Editor({ value, onChange, readOnly = false }: Props) {
  return (
    <textarea
      data-testid="editor"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      readOnly={readOnly}
      style={{
        width: '100%',
        height: '100%',
        resize: 'none',
        fontFamily: 'monospace',
        fontSize: 14,
        lineHeight: 1.45,
        padding: '12px',
        background: '#1e1e1e',
        color: '#d4d4d4',
        border: 'none',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}
