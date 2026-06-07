import { useState } from 'react'
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react'
import { tables, reducers } from './module_bindings'
import { IDENTITY_KEY } from './config'

const ORIGIN = window.location.origin

export function Lobby() {
  const { isActive } = useSpacetimeDB()
  const createRoom = useReducer(reducers.createRoom)
  const [rooms] = useTable(tables.room)

  const [title, setTitle] = useState('')
  const [policy, setPolicy] = useState('syntax-only')
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null)

  const myIdentity = sessionStorage.getItem(IDENTITY_KEY) ?? ''

  function handleCreate() {
    if (!title.trim() || !isActive) return
    const t = title.trim()
    setSubmittedTitle(t)
    createRoom({ title: t, kind: 'interview', policy })
  }

  const createdRoom = submittedTitle
    ? rooms
        .filter(r => r.title === submittedTitle && r.createdBy.toHexString() === myIdentity)
        .sort((a, b) => Number(b.createdAt - a.createdAt))[0]
    : null

  if (createdRoom) {
    const id = String(createdRoom.id)
    return (
      <div style={{ minHeight: '100vh', background: '#111', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: 32 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>Relay</h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, opacity: 0.5 }}>
          Room created · ID: <span data-testid="room-id">{id}</span>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 520 }}>
          <LinkCard testId="candidate-link" label="Candidate" href={`/join/${id}?role=candidate`} origin={ORIGIN} color="#4ade80" />
          <LinkCard testId="interviewer-link" label="Interviewer" href={`/join/${id}?role=interviewer`} origin={ORIGIN} color="#60a5fa" />
          <LinkCard testId="observer-link" label="Observer" href={`/join/${id}?role=observer`} origin={ORIGIN} color="#a78bfa" />
        </div>

        <button
          onClick={() => { setSubmittedTitle(null); setTitle('') }}
          style={{ marginTop: 24, fontSize: 12, opacity: 0.4, background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}
        >
          ← Create another room
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Relay</h1>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.5 }}>
        <span
          data-testid="connection-status"
          style={{ color: isActive ? '#4ade80' : '#f87171' }}
        >
          {isActive ? 'Connected' : 'Connecting…'}
        </span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
        <input
          data-testid="room-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Interview title (e.g. Alice × Acme)"
          style={{ padding: '8px 12px', borderRadius: 6, background: '#1a1a1a', border: '1px solid #333', color: '#e2e8f0', fontSize: 14 }}
        />

        <select
          data-testid="policy-select"
          value={policy}
          onChange={e => setPolicy(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, background: '#1a1a1a', border: '1px solid #333', color: '#e2e8f0', fontSize: 13 }}
        >
          <option value="open">Open (no restrictions)</option>
          <option value="nudge-only">Nudge only (guide, don't solve)</option>
          <option value="syntax-only">Syntax only (brief examples only)</option>
        </select>

        <button
          data-testid="create-room-btn"
          onClick={handleCreate}
          disabled={!isActive || !title.trim()}
          style={{
            padding: '9px 0', borderRadius: 6, fontSize: 14, border: 'none', color: '#fff', cursor: isActive && title.trim() ? 'pointer' : 'default',
            background: isActive && title.trim() ? '#2563eb' : '#1e1e1e',
          }}
        >
          Create Room
        </button>
      </div>
    </div>
  )
}

function LinkCard({ testId, label, href, origin, color }: {
  testId: string; label: string; href: string; origin: string; color: string
}) {
  const full = `${origin}${href}`
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, opacity: 0.45, marginBottom: 6, letterSpacing: 0.5 }}>{label.toUpperCase()}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <a
          data-testid={testId}
          href={href}
          style={{ flex: 1, fontSize: 12, color, wordBreak: 'break-all', textDecoration: 'none' }}
        >
          {full}
        </a>
        <button
          onClick={() => navigator.clipboard?.writeText(full)}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#2a2a2a', border: 'none', color: '#aaa', cursor: 'pointer', flexShrink: 0 }}
        >
          Copy
        </button>
      </div>
    </div>
  )
}
