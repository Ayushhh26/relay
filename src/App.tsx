import { useRef, useState, useEffect } from 'react'
import { tables, reducers } from './module_bindings'
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react'
import { Editor } from './Editor'

const params = new URLSearchParams(window.location.search)
export const ROOM_ID = BigInt(params.get('room') ?? '1')
export const ROLE = params.get('role') ?? 'observer'
export const NAME = params.get('name') ?? ROLE
export const POLICY = params.get('policy') ?? 'open'

const IS_CANDIDATE = ROLE === 'candidate'

function App() {
  const { isActive } = useSpacetimeDB()
  const createRoom = useReducer(reducers.createRoom)
  const updateDocument = useReducer(reducers.updateDocument)

  const [rooms, roomsReady] = useTable(tables.room)
  const [docs] = useTable(tables.document)

  const remoteDoc = docs.find(d => d.roomId === ROOM_ID)

  const [localContent, setLocalContent] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPendingWrite = useRef(false)

  // Seed room on first connect
  if (isActive && roomsReady && rooms.length === 0) {
    createRoom({ title: 'Interview Room' })
  }

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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 16 }}>Relay</h1>
        <span
          data-testid="connection-status"
          style={{ fontSize: 12, color: '#4ade80' }}
        >
          Connected
        </span>
        <span style={{ fontSize: 12, opacity: 0.5 }}>{ROLE}</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Editor
          value={editorValue}
          onChange={IS_CANDIDATE ? handleChange : undefined}
          readOnly={!IS_CANDIDATE}
        />
      </div>
    </div>
  )
}

export default App
