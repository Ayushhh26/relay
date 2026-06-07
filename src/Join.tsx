import { useRef, useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react'
import { tables, reducers } from './module_bindings'
import { profileDisplayName } from './profileDisplayName'
import { validRolesForKind, isStudyRoom, isRoomClosed } from './roomConfig'
import { saveRoomMembership } from './roomMembership'

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true'

export function Join() {
  if (AUTH_ENABLED) return <JoinAuthed />
  return <JoinInner profileDefaultName="" />
}

function JoinAuthed() {
  const auth = useAuth()
  return <JoinInner profileDefaultName={profileDisplayName(auth)} />
}

function JoinInner({ profileDefaultName }: { profileDefaultName: string }) {
  const { roomId: roomIdStr } = useParams<{ roomId: string }>()
  const roomId = BigInt(roomIdStr!)
  const [searchParams] = useSearchParams()
  const role = searchParams.get('role') ?? 'observer'
  const nameFromUrl = searchParams.get('name') ?? ''

  const navigate = useNavigate()
  const { isActive } = useSpacetimeDB()
  const joinRoomFn = useReducer(reducers.joinRoom)

  const [rooms, roomsReady] = useTable(tables.room)
  const [participants, participantsReady] = useTable(tables.participant)
  const defaultName = nameFromUrl || profileDefaultName
  const [name, setName] = useState(defaultName)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const hasAutoJoined = useRef(false)

  const room = rooms.find(r => r.id === roomId)
  const activeCandidates = participants.filter(
    p => p.roomId === roomId && p.active && p.role === 'candidate'
  )
  const isInterview = !isStudyRoom(room?.kind)

  async function attemptJoin(displayName: string) {
    if (!room) {
      setJoinError('Room not found')
      return
    }
    if (isRoomClosed(room)) {
      setJoinError('This session has ended')
      return
    }
    if (!validRolesForKind(room.kind).includes(role)) {
      setJoinError(`Role "${role}" is not valid for this room type`)
      return
    }
    if (isInterview && role === 'candidate' && activeCandidates.length > 0) {
      setJoinError('Candidate seat already taken')
      return
    }

    setJoining(true)
    setJoinError(null)
    try {
      await joinRoomFn({ roomId, displayName, role })
      saveRoomMembership(roomId, { displayName, role })
      navigate(`/room/${roomId}`, { replace: true })
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Failed to join room')
    } finally {
      setJoining(false)
    }
  }

  // Auto-join when name is in URL, once subscriptions have settled
  useEffect(() => {
    if (!isActive || !roomsReady || !participantsReady || joining) return
    if (hasAutoJoined.current || !nameFromUrl) return
    hasAutoJoined.current = true
    void attemptJoin(nameFromUrl)
  }, [isActive, roomsReady, participantsReady, nameFromUrl, joining])

  function handleJoin() {
    if (!name.trim() || !isActive || joining) return
    void attemptJoin(name.trim())
  }

  if (!isActive) {
    return (
      <div style={{ minHeight: '100vh', background: '#111', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <span data-testid="connection-status" style={{ color: '#f87171' }}>Connecting…</span>
      </div>
    )
  }

  if (!roomsReady || !participantsReady) {
    return (
      <div style={{ minHeight: '100vh', background: '#111', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', gap: 12 }}>
        <span data-testid="connection-status" style={{ color: '#4ade80' }}>Connected</span>
        <span style={{ opacity: 0.4, fontSize: 13 }}>Checking room…</span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', gap: 16 }}>
      <span data-testid="connection-status" style={{ display: 'none' }}>Connected</span>

      <h1 style={{ margin: 0, fontSize: 20 }}>Relay</h1>
      {room && <p style={{ margin: 0, fontSize: 13, opacity: 0.5 }}>{room.title}</p>}
      {!room && !joinError && (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.5 }}>Room {String(roomId)} not found</p>
      )}

      {joinError && (
        <div
          data-testid="join-error"
          style={{ padding: '10px 16px', borderRadius: 6, background: '#2a1a1a', border: '1px solid #7f1d1d', color: '#f87171', fontSize: 13 }}
        >
          {joinError}
        </div>
      )}

      {!nameFromUrl && !joining && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>
            Joining as <strong>{role}</strong>
          </p>
          <input
            data-testid="name-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Your name"
            autoFocus
            style={{ padding: '8px 12px', borderRadius: 6, background: '#1a1a1a', border: '1px solid #333', color: '#e2e8f0', fontSize: 14 }}
          />
          <button
            data-testid="join-btn"
            onClick={handleJoin}
            disabled={!name.trim() || !room}
            style={{ padding: '9px 0', borderRadius: 6, fontSize: 14, border: 'none', color: '#fff', cursor: name.trim() && room ? 'pointer' : 'default', background: name.trim() && room ? '#2563eb' : '#1e1e1e' }}
          >
            Join as {role}
          </button>
        </div>
      )}

      {joining && (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.4 }}>
          {nameFromUrl ? `Joining as ${nameFromUrl}…` : 'Joining…'}
        </p>
      )}
    </div>
  )
}
