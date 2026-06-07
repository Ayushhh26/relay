import { useRef, useState, useEffect } from 'react'
import { tables, reducers } from './module_bindings'
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react'
import { Editor } from './Editor'
import { AssistPanel } from './AssistPanel'

const params = new URLSearchParams(window.location.search)
export const ROOM_ID = BigInt(params.get('room') ?? '1')
export const ROLE = params.get('role') ?? 'observer'
export const NAME = params.get('name') ?? ROLE
export const POLICY = params.get('policy') ?? 'open'

const IS_CANDIDATE = ROLE === 'candidate'

const DOT_COLOR: Record<string, string> = {
  candidate: '#4ade80',
  interviewer: '#60a5fa',
  observer: '#a78bfa',
}

function App() {
  const { isActive } = useSpacetimeDB()
  const createRoom = useReducer(reducers.createRoom)
  const updateDocument = useReducer(reducers.updateDocument)
  const joinRoom = useReducer(reducers.joinRoom)

  const [rooms, roomsReady] = useTable(tables.room)
  const [docs] = useTable(tables.document)
  const [participants] = useTable(tables.participant)

  const remoteDoc = docs.find(d => d.roomId === ROOM_ID)
  const activeParticipants = participants.filter(p => p.roomId === ROOM_ID && p.active)

  const [localContent, setLocalContent] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPendingWrite = useRef(false)
  const hasJoined = useRef(false)

  // Seed room on first connect
  if (isActive && roomsReady && rooms.length === 0) {
    createRoom({ title: 'Interview Room' })
  }

  // Join room once on connect
  useEffect(() => {
    if (isActive && !hasJoined.current) {
      hasJoined.current = true
      joinRoom({ roomId: ROOM_ID, displayName: NAME, role: ROLE })
    }
  }, [isActive])

  // Sync remote document into local state (skip while candidate has a pending write)
  useEffect(() => {
    if (remoteDoc && !hasPendingWrite.current) {
      setLocalContent(remoteDoc.content)
    }
  }, [remoteDoc?.content])

  function handleChange(val: string) {
    setLocalContent(val)
    hasPendingWrite.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateDocument({ roomId: ROOM_ID, content: val })
      hasPendingWrite.current = false
    }, 300)
  }

  const editorValue = IS_CANDIDATE ? localContent : (remoteDoc?.content ?? '')

  if (!isActive) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <span data-testid="connection-status" style={{ color: '#f87171' }}>Connecting…</span>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', background: '#111', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ padding: '6px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 15, letterSpacing: 1 }}>Relay</h1>
        <span data-testid="connection-status" style={{ fontSize: 11, color: '#4ade80' }}>Connected</span>
        <span style={{ fontSize: 11, opacity: 0.4 }}>{ROLE}</span>
      </div>

      {/* Presence bar */}
      <div
        data-testid="presence-bar"
        style={{ display: 'flex', gap: 10, padding: '5px 16px', borderBottom: '1px solid #1a1a1a', background: '#0d0d0d', minHeight: 28 }}
      >
        {activeParticipants.map(p => (
          <span key={String(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: DOT_COLOR[p.role] ?? '#888',
              flexShrink: 0,
            }} />
            {p.displayName}
            <em style={{ fontSize: 10, opacity: 0.5 }}>({p.role})</em>
          </span>
        ))}
      </div>

      {/* Main area: editor + assist panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Editor
            value={editorValue}
            onChange={IS_CANDIDATE ? handleChange : undefined}
            readOnly={!IS_CANDIDATE}
          />
        </div>
        <div style={{ width: 340, borderLeft: '1px solid #1a1a1a', overflow: 'hidden' }}>
          <AssistPanel roomId={ROOM_ID} policy={POLICY} />
        </div>
      </div>
    </div>
  )
}

export default App
