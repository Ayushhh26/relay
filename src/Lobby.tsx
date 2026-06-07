import { useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react'
import { tables, reducers } from './module_bindings'
import { profileDisplayName } from './profileDisplayName'
import { saveRoomMembership } from './roomMembership'

const ORIGIN = window.location.origin
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true'

const selectStyle: CSSProperties = {
  padding: '8px 12px', borderRadius: 6, background: '#1a1a1a',
  border: '1px solid #333', color: '#e2e8f0', fontSize: 13,
}

export function Lobby() {
  const { isActive, identity } = useSpacetimeDB()
  const createRoom = useReducer(reducers.createRoom)

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('interview')
  const [policy, setPolicy] = useState('syntax-only')
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null)
  const [createdRoomId, setCreatedRoomId] = useState<bigint | null>(null)
  const submittedKindRef = useRef('interview')

  const submittedTitleRef = useRef<string | null>(null)

  const [rooms] = useTable(tables.room, {
    onInsert: row => {
      if (row.title !== submittedTitleRef.current) return
      setCreatedRoomId(row.id)
    },
  })

  function handleCreate() {
    if (!title.trim() || !isActive) return
    const t = title.trim()
    submittedTitleRef.current = t
    submittedKindRef.current = kind
    setSubmittedTitle(t)
    setCreatedRoomId(null)
    createRoom({ title: t, kind, policy })
  }

  // Fallback: match from subscription snapshot (e.g. if insert event was missed)
  const createdRoom = createdRoomId != null
    ? rooms.find(r => r.id === createdRoomId)
    : submittedTitle
      ? rooms
          .filter(r => {
            if (r.title !== submittedTitle) return false
            const hex = identity?.toHexString() ?? ''
            if (hex) return r.createdBy.toHexString() === hex
            return true
          })
          .sort((a, b) => Number(b.createdAt - a.createdAt))[0]
      : null

  const resolvedRoomId = createdRoomId ?? createdRoom?.id ?? null
  // Use DB value if available, fall back to what we submitted
  const roomKind = createdRoom?.kind ?? submittedKindRef.current
  const isStudy = roomKind === 'study'

  if (submittedTitle && resolvedRoomId == null) {
    return (
      <div style={{ minHeight: '100vh', background: '#111', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Relay</h1>
        <span data-testid="connection-status" style={{ fontSize: 13, color: '#4ade80' }}>Connected</span>
        <p data-testid="creating-room" style={{ margin: 0, fontSize: 13, opacity: 0.5 }}>Creating room…</p>
      </div>
    )
  }

  if (resolvedRoomId != null) {
    const id = String(resolvedRoomId)
    return (
      <div style={{ minHeight: '100vh', background: '#111', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: 32 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>Relay</h1>
        <p style={{ margin: '0 0 24px', fontSize: 13, opacity: 0.5 }}>
          Room created · ID: <span data-testid="room-id">{id}</span>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 520 }}>
          {isStudy ? (
            AUTH_ENABLED
              ? <EnterAsHostAuthed roomId={id} />
              : <EnterAsHostAnon roomId={id} />
          ) : (
            AUTH_ENABLED
              ? <EnterAsInterviewerAuthed roomId={id} />
              : <EnterAsInterviewerAnon roomId={id} />
          )}

          <p style={{ margin: 0, fontSize: 11, opacity: 0.4, textAlign: 'center' }}>
            Share invite links with others
          </p>

          {isStudy ? (
            <>
              <LinkCard testId="host-link" label="Host" href={`/join/${id}?role=host`} origin={ORIGIN} color="#f59e0b" />
              <LinkCard testId="member-link" label="Member" href={`/join/${id}?role=member`} origin={ORIGIN} color="#34d399" />
            </>
          ) : (
            <>
              <LinkCard testId="candidate-link" label="Candidate" href={`/join/${id}?role=candidate`} origin={ORIGIN} color="#4ade80" />
              <LinkCard testId="interviewer-link" label="Interviewer" href={`/join/${id}?role=interviewer`} origin={ORIGIN} color="#60a5fa" />
              <LinkCard testId="observer-link" label="Observer" href={`/join/${id}?role=observer`} origin={ORIGIN} color="#a78bfa" />
            </>
          )}
        </div>

        <button
          onClick={() => { submittedTitleRef.current = null; setSubmittedTitle(null); setCreatedRoomId(null); setTitle('') }}
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
          placeholder="Room title (e.g. Alice × Acme)"
          style={{ padding: '8px 12px', borderRadius: 6, background: '#1a1a1a', border: '1px solid #333', color: '#e2e8f0', fontSize: 14 }}
        />

        <select
          data-testid="room-kind-select"
          value={kind}
          onChange={e => setKind(e.target.value)}
          style={selectStyle}
        >
          <option value="interview">Interview (candidate edits)</option>
          <option value="study">Study session (everyone edits)</option>
        </select>

        <select
          data-testid="policy-select"
          value={policy}
          onChange={e => setPolicy(e.target.value)}
          style={selectStyle}
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
            padding: '9px 0', borderRadius: 6, fontSize: 14, border: 'none', color: '#fff',
            cursor: isActive && title.trim() ? 'pointer' : 'default',
            background: isActive && title.trim() ? '#2563eb' : '#1e1e1e',
          }}
        >
          Create Room
        </button>
      </div>
    </div>
  )
}

// ── Enter hooks ───────────────────────────────────────────────────────────────

function useEnterAsRole(roomId: string, role: 'interviewer' | 'host') {
  const navigate = useNavigate()
  const joinRoom = useReducer(reducers.joinRoom)
  const { isActive } = useSpacetimeDB()
  const [joining, setJoining] = useState(false)

  async function enter(displayName: string) {
    if (!isActive || joining) return
    setJoining(true)
    try {
      await joinRoom({ roomId: BigInt(roomId), displayName, role })
      saveRoomMembership(roomId, { displayName, role })
      navigate(`/room/${roomId}`, { replace: true })
    } finally {
      setJoining(false)
    }
  }

  return { enter, joining, isActive }
}

function enterButtonStyle(enabled: boolean): CSSProperties {
  return {
    padding: '11px 0', borderRadius: 8, fontSize: 14, fontWeight: 600,
    border: 'none', color: '#fff',
    cursor: enabled ? 'pointer' : 'default',
    background: enabled ? '#2563eb' : '#1e1e1e',
  }
}

function EnterAsInterviewerAuthed({ roomId }: { roomId: string }) {
  const auth = useAuth()
  const { enter, joining, isActive } = useEnterAsRole(roomId, 'interviewer')
  const enabled = isActive && !joining
  return (
    <button
      data-testid="enter-as-interviewer-btn"
      onClick={() => enter(profileDisplayName(auth, 'Interviewer'))}
      disabled={!enabled}
      style={enterButtonStyle(enabled)}
    >
      {joining ? 'Entering room…' : 'Enter as interviewer →'}
    </button>
  )
}

function EnterAsInterviewerAnon({ roomId }: { roomId: string }) {
  const { enter, joining, isActive } = useEnterAsRole(roomId, 'interviewer')
  const enabled = isActive && !joining
  return (
    <button
      data-testid="enter-as-interviewer-btn"
      onClick={() => enter('Interviewer')}
      disabled={!enabled}
      style={enterButtonStyle(enabled)}
    >
      {joining ? 'Entering room…' : 'Enter as interviewer →'}
    </button>
  )
}

function EnterAsHostAuthed({ roomId }: { roomId: string }) {
  const auth = useAuth()
  const { enter, joining, isActive } = useEnterAsRole(roomId, 'host')
  const enabled = isActive && !joining
  return (
    <button
      data-testid="enter-as-host-btn"
      onClick={() => enter(profileDisplayName(auth, 'Host'))}
      disabled={!enabled}
      style={enterButtonStyle(enabled)}
    >
      {joining ? 'Entering room…' : 'Enter as host →'}
    </button>
  )
}

function EnterAsHostAnon({ roomId }: { roomId: string }) {
  const { enter, joining, isActive } = useEnterAsRole(roomId, 'host')
  const enabled = isActive && !joining
  return (
    <button
      data-testid="enter-as-host-btn"
      onClick={() => enter('Host')}
      disabled={!enabled}
      style={enterButtonStyle(enabled)}
    >
      {joining ? 'Entering room…' : 'Enter as host →'}
    </button>
  )
}

// ── LinkCard ──────────────────────────────────────────────────────────────────

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
