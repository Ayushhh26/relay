import { useRef, useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react'
import { tables, reducers } from './module_bindings'
import { Editor } from './Editor'
import { AssistPanel } from './AssistPanel'
import { RunPanel } from './RunPanel'

const DOT_COLOR: Record<string, string> = {
  candidate: '#4ade80',
  interviewer: '#60a5fa',
  observer: '#a78bfa',
}

export function RoomView() {
  const { roomId: roomIdStr } = useParams<{ roomId: string }>()
  const ROOM_ID = BigInt(roomIdStr!)

  const { isActive, identity } = useSpacetimeDB()
  const myIdentityHex = identity?.toHexString() ?? ''
  const updateDocument = useReducer(reducers.updateDocument)
  const appendRunOutput = useReducer(reducers.appendRunOutput)
  const clearRunOutput = useReducer(reducers.clearRunOutput)

  const [rooms] = useTable(tables.room)
  const [docs] = useTable(tables.document)
  const [participants] = useTable(tables.participant)
  const [runOutputs] = useTable(tables.runOutput)

  const currentRoom = rooms.find(r => r.id === ROOM_ID)
  const remoteDoc = docs.find(d => d.roomId === ROOM_ID)
  const activeParticipants = participants.filter(p => p.roomId === ROOM_ID && p.active)
  const roomOutputs = runOutputs.filter(r => r.roomId === ROOM_ID)

  // Derive role/permissions from the DB participant row — not from URL
  const myParticipant = activeParticipants.find(
    p => p.identity.toHexString() === myIdentityHex
  )
  const canEditDoc = myParticipant?.role === 'candidate'
  const canAsk = myParticipant?.role === 'candidate'
  const policy = currentRoom?.policy || 'syntax-only'

  const [localContent, setLocalContent] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPendingWrite = useRef(false)

  useEffect(() => {
    if (remoteDoc && !hasPendingWrite.current) {
      setLocalContent(remoteDoc.content)
    }
  }, [remoteDoc?.content])

  function handleRun() {
    clearRunOutput({ roomId: ROOM_ID })
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    let seq = 0n
    worker.onmessage = (e: MessageEvent<{ logs: Array<{ stream: string; text: string }>; error: string | null }>) => {
      const { logs, error } = e.data
      for (const { stream, text } of logs) {
        appendRunOutput({ roomId: ROOM_ID, seq, stream, text })
        seq++
      }
      if (error) appendRunOutput({ roomId: ROOM_ID, seq, stream: 'stderr', text: error })
      worker.terminate()
    }
    worker.postMessage({ code: editorValue })
  }

  function handleChange(val: string) {
    setLocalContent(val)
    hasPendingWrite.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateDocument({ roomId: ROOM_ID, content: val })
      hasPendingWrite.current = false
    }, 300)
  }

  const editorValue = canEditDoc ? localContent : (remoteDoc?.content ?? '')

  if (!isActive) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#111', minHeight: '100vh', color: '#e2e8f0' }}>
        <span data-testid="connection-status" style={{ color: '#f87171' }}>Connecting…</span>
      </div>
    )
  }

  if (!myParticipant) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#111', minHeight: '100vh', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span data-testid="connection-status" style={{ color: '#4ade80' }}>Connected</span>
        <span style={{ marginLeft: 12, opacity: 0.4, fontSize: 13 }}>Loading room…</span>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', background: '#111', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ padding: '6px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 15, letterSpacing: 1 }}>Relay</h1>
        {currentRoom && (
          <span style={{ fontSize: 12, opacity: 0.6, fontWeight: 500 }}>{currentRoom.title}</span>
        )}
        <span data-testid="connection-status" style={{ fontSize: 11, color: '#4ade80' }}>Connected</span>
        <span style={{ fontSize: 11, opacity: 0.4 }}>{myParticipant.role}</span>
      </div>

      {/* Presence bar */}
      <div
        data-testid="presence-bar"
        style={{ display: 'flex', gap: 10, padding: '5px 16px', borderBottom: '1px solid #1a1a1a', background: '#0d0d0d', minHeight: 28 }}
      >
        {activeParticipants.map(p => (
          <span key={String(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <span className="dot" style={{ width: 8, height: 8, borderRadius: '50%', background: DOT_COLOR[p.role] ?? '#888', flexShrink: 0 }} />
            {p.displayName}
            <em style={{ fontSize: 10, opacity: 0.5 }}>({p.role})</em>
          </span>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {canEditDoc && (
            <div style={{ padding: '4px 8px', background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
              <button
                data-testid="run-button"
                onClick={handleRun}
                style={{ padding: '3px 14px', borderRadius: 4, fontSize: 12, background: '#16a34a', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                ▶ Run
              </button>
            </div>
          )}
          <div style={{ flex: '0 0 60%', overflow: 'hidden' }}>
            <Editor
              value={editorValue}
              onChange={canEditDoc ? handleChange : undefined}
              readOnly={!canEditDoc}
            />
          </div>
          <div style={{ flex: '0 0 40%', borderTop: '1px solid #1a1a1a', overflow: 'hidden' }}>
            <RunPanel outputs={roomOutputs} />
          </div>
        </div>
        <div style={{ width: 340, borderLeft: '1px solid #1a1a1a', overflow: 'hidden' }}>
          <AssistPanel roomId={ROOM_ID} policy={policy} canAsk={canAsk} />
        </div>
      </div>
    </div>
  )
}
