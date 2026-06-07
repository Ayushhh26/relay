import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { canCloseRoom, isStudyRoom, sessionCloseLabel, sessionExitLabel } from './roomConfig'

const DOT_COLOR: Record<string, string> = {
  candidate: '#4ade80',
  interviewer: '#60a5fa',
  observer: '#a78bfa',
  host: '#f59e0b',
  member: '#34d399',
}

const ROLE_LABEL: Record<string, string> = {
  candidate: 'Candidate',
  interviewer: 'Interviewer',
  observer: 'Observer',
  host: 'Host',
  member: 'Member',
}

interface InviteLink {
  testId: string
  label: string
  role: string
  color: string
}

interface Participant {
  id: bigint
  displayName: string
  role: string
}

interface Props {
  roomTitle: string
  roomId: bigint
  roomKind: string
  participants: readonly Participant[]
  myRole: string
  canRun: boolean
  onRun: () => void
  onExit: () => void
  onClose: () => void
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
}

function inviteLinks(roomKind: string): InviteLink[] {
  if (isStudyRoom(roomKind)) {
    return [
      { testId: 'invite-host-link', label: 'Host', role: 'host', color: '#f59e0b' },
      { testId: 'invite-member-link', label: 'Member', role: 'member', color: '#34d399' },
    ]
  }
  return [
    { testId: 'invite-candidate-link', label: 'Candidate', role: 'candidate', color: '#4ade80' },
    { testId: 'invite-interviewer-link', label: 'Interviewer', role: 'interviewer', color: '#60a5fa' },
    { testId: 'invite-observer-link', label: 'Observer', role: 'observer', color: '#a78bfa' },
  ]
}

function InviteMenu({
  roomId,
  roomKind,
  onClose,
}: {
  roomId: bigint
  roomKind: string
  onClose: () => void
}) {
  const origin = window.location.origin
  const links = inviteLinks(roomKind)

  return (
    <div data-testid="invite-menu" style={styles.menu}>
      <div style={styles.menuHeader}>Magic invite links</div>
      {links.map(link => {
        const href = `/join/${String(roomId)}?role=${link.role}`
        const full = `${origin}${href}`
        return (
          <div key={link.role} style={styles.menuItem}>
            <div style={{ ...styles.menuLabel, color: link.color }}>{link.label}</div>
            <div style={styles.menuRow}>
              <a
                data-testid={link.testId}
                href={href}
                style={{ ...styles.menuLink, color: link.color }}
                onClick={e => e.stopPropagation()}
              >
                {full}
              </a>
              <button
                type="button"
                data-testid={`${link.testId}-copy`}
                onClick={() => {
                  void navigator.clipboard?.writeText(full)
                  onClose()
                }}
                style={styles.copyBtn}
              >
                Copy
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function RoomHeader({ roomTitle, roomId, roomKind, participants, myRole, canRun, onRun, onExit, onClose }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const inviteRef = useRef<HTMLDivElement>(null)
  const showClose = canCloseRoom(myRole, roomKind)
  const exitLabel = sessionExitLabel(roomKind)
  const closeLabel = sessionCloseLabel(roomKind)

  useEffect(() => {
    if (!inviteOpen) return
    function onPointerDown(e: MouseEvent) {
      if (!inviteRef.current?.contains(e.target as Node)) {
        setInviteOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [inviteOpen])

  return (
    <header style={styles.wrapper}>
      <div style={styles.topBar}>
        <div style={styles.brandRow}>
          <span style={styles.logo}>Relay</span>
          <span style={styles.divider}>/</span>
          <span style={styles.roomTitle}>{roomTitle || 'Untitled room'}</span>
          <span style={styles.fileHint}>main.js</span>
        </div>

        <div style={styles.actions}>
          <span style={styles.roleBadge}>{ROLE_LABEL[myRole] ?? myRole}</span>
          {canRun && (
            <button
              type="button"
              data-testid="run-button"
              onClick={onRun}
              style={styles.runBtn}
            >
              ▶ Run
            </button>
          )}
          <div ref={inviteRef} style={styles.inviteWrap}>
            <button
              type="button"
              data-testid="invite-button"
              onClick={() => setInviteOpen(open => !open)}
              style={{
                ...styles.secondaryBtn,
                borderColor: inviteOpen ? '#475569' : '#2a2a2a',
              }}
            >
              + Invite
            </button>
            {inviteOpen && (
              <InviteMenu
                roomId={roomId}
                roomKind={roomKind}
                onClose={() => setInviteOpen(false)}
              />
            )}
          </div>
          {showClose ? (
            <button
              type="button"
              data-testid="close-session-button"
              onClick={onClose}
              style={styles.closeBtn}
            >
              {closeLabel}
            </button>
          ) : (
            <button
              type="button"
              data-testid="exit-session-button"
              onClick={onExit}
              style={styles.exitBtn}
            >
              {exitLabel}
            </button>
          )}
        </div>
      </div>

      <div data-testid="presence-bar" style={styles.presenceBar}>
        <div style={styles.liveRow}>
          <span style={styles.liveDot} />
          <span style={styles.liveText}>Live · {participants.length} online</span>
        </div>

        <div style={styles.avatarRow}>
          {participants.map(p => (
            <span
              key={String(p.id)}
              style={{ ...styles.avatar, background: DOT_COLOR[p.role] ?? '#64748b' }}
              title={`${p.displayName} (${p.role})`}
            >
              {initials(p.displayName)}
            </span>
          ))}
        </div>

        <div style={styles.nameRow}>
          {participants.map(p => (
            <span key={String(p.id)} style={styles.nameChip}>
              <span
                className="dot"
                style={{ ...styles.dot, background: DOT_COLOR[p.role] ?? '#888' }}
              />
              <span style={styles.displayName}>{p.displayName}</span>
              <span style={styles.roleHint}>· {ROLE_LABEL[p.role] ?? p.role}</span>
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    flexShrink: 0,
    borderBottom: '1px solid #1a1a1a',
    background: '#0a0a0a',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '10px 16px',
    borderBottom: '1px solid #141414',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  logo: {
    fontSize: 15,
    fontWeight: 700,
    color: '#f8fafc',
    letterSpacing: 0.3,
  },
  divider: {
    color: '#334155',
    fontSize: 14,
  },
  roomTitle: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fileHint: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  roleBadge: {
    fontSize: 11,
    color: '#94a3b8',
    padding: '4px 8px',
    borderRadius: 999,
    background: '#141414',
    border: '1px solid #222',
  },
  runBtn: {
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    background: '#2563eb',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
  },
  inviteWrap: {
    position: 'relative',
  },
  secondaryBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 12,
    background: '#141414',
    border: '1px solid #2a2a2a',
    color: '#e2e8f0',
    cursor: 'pointer',
  },
  exitBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 12,
    background: '#141414',
    border: '1px solid #334155',
    color: '#cbd5e1',
    cursor: 'pointer',
  },
  closeBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    background: '#450a0a',
    border: '1px solid #7f1d1d',
    color: '#fca5a5',
    cursor: 'pointer',
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    width: 360,
    maxWidth: '90vw',
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
    padding: 10,
    zIndex: 50,
  },
  menuHeader: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#64748b',
    padding: '4px 6px 8px',
  },
  menuItem: {
    background: '#1a1a1a',
    border: '1px solid #242424',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 8,
  },
  menuLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  menuRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },
  menuLink: {
    flex: 1,
    fontSize: 11,
    wordBreak: 'break-all',
    textDecoration: 'none',
    lineHeight: 1.4,
  },
  copyBtn: {
    fontSize: 11,
    padding: '4px 8px',
    borderRadius: 4,
    background: '#2a2a2a',
    border: 'none',
    color: '#cbd5e1',
    cursor: 'pointer',
    flexShrink: 0,
  },
  presenceBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '8px 16px',
    overflowX: 'auto',
    minHeight: 40,
  },
  liveRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#22c55e',
  },
  liveText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  avatarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontWeight: 700,
    color: '#0f172a',
    border: '2px solid #0a0a0a',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    minWidth: 0,
  },
  nameChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  displayName: {
    color: '#e2e8f0',
    fontWeight: 500,
  },
  roleHint: {
    color: '#64748b',
    fontSize: 11,
  },
}
