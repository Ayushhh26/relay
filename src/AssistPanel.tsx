import { useRef, useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { tables, reducers } from './module_bindings'
import type { RunOutput } from './module_bindings/types'
import { useReducer, useTable } from 'spacetimedb/react'
import { formatRunOutput } from './assistContext'

const TAG_COLOR: Record<string, string> = {
  syntax: '#4ade80',
  nudge: '#facc15',
  'solution-leaning': '#f87171',
}

const API_URL = (import.meta.env.VITE_API_URL as string) ?? ''

interface Props {
  roomId: bigint
  policy: string
  canAsk: boolean
  roomKind: string
  code: string
  runOutput: RunOutput[]
  roomTitle: string
  myRole: string
}

export function AssistPanel({ roomId, policy, canAsk, roomKind, code, runOutput, roomTitle, myRole }: Props) {
  const finalizeAssistLog = useReducer(reducers.finalizeAssistLog)
  const [allLogs] = useTable(tables.assistLog)
  const roomLogs = allLogs.filter(l => l.roomId === roomId)

  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [roomLogs.length])

  async function handleAsk() {
    if (!prompt.trim() || loading) return
    const sent = prompt
    setLoading(true)
    setApiError(null)
    setPrompt('')
    try {
      const body = roomKind === 'study'
        ? { prompt: sent, policy, roomKind, code, runOutput: formatRunOutput(runOutput), role: myRole, roomTitle }
        : { prompt: sent, policy }

      const res = await fetch(`${API_URL}/api/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const { response, requestedType, assistType, policyStatus } = await res.json()
      finalizeAssistLog({
        roomId,
        promptText: sent,
        responseText: response,
        requestedType,
        assistType,
        policyStatus,
      })
    } catch (err) {
      setApiError(String(err))
      setPrompt(sent)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.sparkle}>✦</span>
        <span style={styles.title}>
          {roomKind === 'study' ? 'Study Assistant' : 'AI Assistant'}
        </span>
      </div>

      <div data-testid="assist-log" style={styles.log}>
        {roomLogs.length === 0 && (
          <div style={styles.welcome}>
            Hi! I&apos;m your AI pair-programmer. Ask me to explain, refactor, or generate code.
          </div>
        )}
        {roomLogs.map(log => (
          <div key={String(log.id)} style={styles.entry}>
            <div style={styles.meta}>
              <span style={{ color: TAG_COLOR[log.requestedType] ?? '#aaa' }}>
                requested: {log.requestedType}
              </span>
              <span style={styles.metaSep}>·</span>
              <span style={{ color: TAG_COLOR[log.assistType] ?? '#aaa' }}>
                delivered: {log.assistType}
              </span>
              <span style={styles.metaSep}>·</span>
              {log.policyStatus === 'downgraded'
                ? <span style={{ color: '#facc15' }}>policy enforced</span>
                : <span style={{ opacity: 0.4 }}>allowed</span>}
            </div>
            <div style={styles.question}>Q: {log.promptText}</div>
            <pre style={styles.answer}>{log.responseText}</pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {apiError && <div style={styles.error}>{apiError}</div>}
      {!canAsk && (
        <div style={styles.disabledHint}>
          {roomKind === 'study'
            ? 'Join the room to request assistance'
            : 'Only candidates can request assistance'}
        </div>
      )}
      <div style={{ ...styles.inputRow, display: canAsk ? 'flex' : 'none' }}>
        <input
          data-testid="assist-input"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAsk()}
          placeholder="Ask AI to explain or refactor…"
          disabled={loading}
          style={styles.input}
        />
        <button
          data-testid="assist-submit"
          onClick={handleAsk}
          disabled={loading || !prompt.trim()}
          style={{
            ...styles.sendBtn,
            opacity: loading || !prompt.trim() ? 0.5 : 1,
          }}
        >
          {loading ? '…' : '→'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#0a0a0a',
    borderLeft: '1px solid #1a1a1a',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    borderBottom: '1px solid #141414',
  },
  sparkle: {
    color: '#818cf8',
    fontSize: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  log: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 14px',
  },
  welcome: {
    fontSize: 13,
    lineHeight: 1.55,
    color: '#94a3b8',
    background: '#111',
    border: '1px solid #1f1f1f',
    borderRadius: 10,
    padding: '12px 14px',
  },
  entry: {
    marginBottom: 14,
    borderBottom: '1px solid #1e1e1e',
    paddingBottom: 10,
  },
  meta: {
    fontSize: 11,
    marginBottom: 4,
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaSep: {
    opacity: 0.3,
  },
  question: {
    fontSize: 11,
    opacity: 0.55,
    marginBottom: 4,
  },
  answer: {
    margin: 0,
    fontSize: 12,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.45,
    color: '#c9d1d9',
  },
  error: {
    fontSize: 11,
    color: '#f87171',
    padding: '0 14px 6px',
  },
  disabledHint: {
    fontSize: 11,
    opacity: 0.3,
    textAlign: 'center',
    padding: '6px 14px 10px',
  },
  inputRow: {
    gap: 8,
    padding: '10px 14px 12px',
    borderTop: '1px solid #141414',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    background: '#111',
    border: '1px solid #2a2a2a',
    color: '#e2e8f0',
    fontSize: 12,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: '#2563eb',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 16,
  },
}
