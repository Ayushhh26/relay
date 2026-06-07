import { useRef, useState } from 'react'
import { tables, reducers } from './module_bindings'
import { useReducer, useTable } from 'spacetimedb/react'

const TAG_COLOR: Record<string, string> = {
  syntax: '#4ade80',
  nudge: '#facc15',
  'solution-leaning': '#f87171',
}

const API_URL = (import.meta.env.VITE_API_URL as string) ?? ''

interface Props {
  roomId: bigint
  policy: string
}

export function AssistPanel({ roomId, policy }: Props) {
  const finalizeAssistLog = useReducer(reducers.finalizeAssistLog)
  const [allLogs] = useTable(tables.assistLog)
  const roomLogs = allLogs.filter(l => l.roomId === roomId)

  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function handleAsk() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, policy }),
      })
      const { response, requestedType, assistType, policyStatus } = await res.json()
      finalizeAssistLog({
        roomId,
        promptText: prompt,
        responseText: response,
        requestedType,
        assistType,
        policyStatus,
      })
      setPrompt('')
    } finally {
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, boxSizing: 'border-box', background: '#0a0a0a' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 13, letterSpacing: 1, color: '#888' }}>ASSIST LOG</h3>

      <div data-testid="assist-log" style={{ flex: 1, overflowY: 'auto', marginBottom: 8 }}>
        {roomLogs.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.35, paddingTop: 4 }}>No assists yet.</div>
        )}
        {roomLogs.map(log => (
          <div key={String(log.id)} style={{ marginBottom: 14, borderBottom: '1px solid #1e1e1e', paddingBottom: 10 }}>
            <div style={{ fontSize: 11, marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: TAG_COLOR[log.requestedType] ?? '#aaa' }}>
                requested: {log.requestedType}
              </span>
              <span style={{ opacity: 0.3 }}>·</span>
              <span style={{ color: TAG_COLOR[log.assistType] ?? '#aaa' }}>
                delivered: {log.assistType}
              </span>
              <span style={{ opacity: 0.3 }}>·</span>
              {log.policyStatus === 'downgraded'
                ? <span style={{ color: '#facc15' }}>policy enforced</span>
                : <span style={{ opacity: 0.4 }}>allowed</span>}
            </div>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>Q: {log.promptText}</div>
            <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.45, color: '#c9d1d9' }}>
              {log.responseText}
            </pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          data-testid="assist-input"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAsk()}
          placeholder="Ask for help…"
          disabled={loading}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: 4,
            background: '#1a1a1a', border: '1px solid #333', color: '#e2e8f0',
            fontSize: 12,
          }}
        />
        <button
          data-testid="assist-submit"
          onClick={handleAsk}
          disabled={loading || !prompt.trim()}
          style={{
            padding: '6px 12px', borderRadius: 4, fontSize: 12,
            background: loading ? '#222' : '#2563eb', border: 'none', color: '#fff',
            cursor: loading || !prompt.trim() ? 'default' : 'pointer',
          }}
        >
          {loading ? '…' : 'Ask'}
        </button>
      </div>
    </div>
  )
}
