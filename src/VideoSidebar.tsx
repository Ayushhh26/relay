import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { isActiveVideoTrack, type UseVideoCallReturn, type VideoParticipant } from './useVideoCall'

function liveAudioTracks(stream: MediaStream | null | undefined, participantMuted: boolean) {
  if (participantMuted || !stream) return []
  return stream.getAudioTracks().filter(t => t.readyState === 'live' && !t.muted)
}

function AudioLevelBars({ level, active }: { level: number; active: boolean }) {
  const bars = 4
  return (
    <div data-testid="audio-level" style={styles.audioMeter} aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        const threshold = (i + 1) / bars
        const on = active && level >= threshold * 0.35
        return (
          <span
            key={i}
            style={{
              ...styles.audioBar,
              height: 4 + i * 2,
              background: on ? '#22c55e' : '#334155',
              opacity: on ? 1 : 0.55,
            }}
          />
        )
      })}
    </div>
  )
}

const ROLE_COLOR: Record<string, string> = {
  candidate: '#4ade80',
  interviewer: '#60a5fa',
  observer: '#a78bfa',
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {muted ? (
        <>
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </>
      ) : (
        <>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </>
      )}
    </svg>
  )
}

function VideoIcon({ off }: { off: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </>
      )}
    </svg>
  )
}

function ParticipantTile({ participant }: { participant: VideoParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const level = participant.audioLevel
  const speaking = !participant.muted && level > 0.06

  useLayoutEffect(() => {
    const el = videoRef.current
    if (!el) return

    if (participant.isLocal) {
      const track = participant.localTrack
      if (!track || track.readyState === 'ended' || participant.videoOff) {
        el.srcObject = null
        return
      }
      el.srcObject = new MediaStream([track])
      void el.play().catch(() => {})
      return
    }

    const audioTracks = liveAudioTracks(participant.stream, participant.muted)
    const videoTracks = (participant.stream?.getVideoTracks() ?? []).filter(
      t => isActiveVideoTrack(t) && !participant.videoOff,
    )

    if (audioTracks.length === 0 && videoTracks.length === 0) {
      el.srcObject = null
      return
    }

    el.srcObject = new MediaStream([...audioTracks, ...videoTracks])
    void el.play().catch(() => {})
  }, [
    participant.isLocal,
    participant.localTrack,
    participant.stream,
    participant.videoOff,
    participant.muted,
    participant.streamKey,
  ])

  const initials = participant.displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const showVideo = participant.isLocal
    ? !participant.videoOff && !!participant.localTrack && participant.localTrack.readyState === 'live'
    : !participant.videoOff &&
      (participant.stream?.getVideoTracks().some(isActiveVideoTrack) ?? false)

  const borderColor = participant.isLocal
    ? (ROLE_COLOR[participant.role] ?? '#4ade80')
    : (ROLE_COLOR[participant.role] ?? '#444')

  const testId = participant.isLocal
    ? 'video-tile-local'
    : `video-tile-${participant.role}`

  return (
    <div
      data-testid={testId}
      style={{
        ...styles.tile,
        boxShadow: speaking ? '0 0 0 2px #22c55e88' : undefined,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.isLocal}
        style={{
          ...styles.video,
          display: showVideo || (!participant.isLocal && liveAudioTracks(participant.stream, participant.muted).length > 0)
            ? 'block'
            : 'none',
          visibility: showVideo ? 'visible' : 'hidden',
          transform: participant.isLocal ? 'scaleX(-1)' : undefined,
        }}
      />
      {!showVideo && (
        <div style={{ ...styles.avatar, borderColor }}>
          <span style={styles.avatarText}>{participant.isLocal ? 'You' : (initials || '?')}</span>
        </div>
      )}
      <div style={styles.nameBar}>
        <span style={styles.name}>
          {participant.isLocal ? `You (${participant.role})` : participant.displayName}
          {!participant.isLocal && (
            <span style={styles.roleHint}> ({participant.role})</span>
          )}
        </span>
        <div style={styles.statusIcons}>
          {!participant.muted && <AudioLevelBars level={level} active />}
        </div>
      </div>
    </div>
  )
}

interface Props {
  call: UseVideoCallReturn
}

export function VideoSidebar({ call }: Props) {
  const {
    participants,
    isMuted,
    isVideoOff,
    videoError,
    isVideoReady,
    toggleMute,
    toggleVideo,
    localAudioLevel,
  } = call

  const speaking = !isMuted && localAudioLevel > 0.06

  return (
    <aside data-testid="video-sidebar" style={styles.sidebar}>
      <div style={styles.header}>
        <span style={styles.headerDot} />
        <span style={styles.headerText}>{participants.length} in call</span>
      </div>

      <div style={styles.tileList}>
        {videoError && <div style={styles.error}>{videoError}</div>}
        {!isVideoReady && !videoError && <div style={styles.hint}>Starting camera…</div>}

        {participants.map(p => (
          <ParticipantTile key={p.identity} participant={p} />
        ))}
      </div>

      <div style={styles.controls}>
        <button
          type="button"
          data-testid="video-toggle-mute"
          onClick={toggleMute}
          style={{
            ...styles.controlBtn,
            borderColor: isMuted ? '#f87171' : speaking ? '#22c55e' : '#333',
            color: isMuted ? '#f87171' : '#e2e8f0',
          }}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <MicIcon muted />
          ) : speaking ? (
            <AudioLevelBars level={localAudioLevel} active />
          ) : (
            <MicIcon muted={false} />
          )}
        </button>
        <button
          type="button"
          data-testid="video-toggle-camera"
          onClick={() => { void toggleVideo() }}
          style={{
            ...styles.controlBtn,
            borderColor: isVideoOff ? '#facc15' : '#333',
            color: isVideoOff ? '#facc15' : '#e2e8f0',
          }}
          title={isVideoOff ? 'Start video' : 'Stop video'}
        >
          <VideoIcon off={isVideoOff} />
        </button>
      </div>
    </aside>
  )
}

const styles: Record<string, CSSProperties> = {
  sidebar: {
    width: 156,
    minWidth: 156,
    height: '100%',
    background: '#0a0a0a',
    borderRight: '1px solid #1a1a1a',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 10px 8px',
    borderBottom: '1px solid #1a1a1a',
  },
  headerDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#22c55e',
  },
  headerText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: 500,
  },
  tileList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 6,
  },
  tile: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4/3',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#161616',
    border: '1px solid #222',
    flexShrink: 0,
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    background: '#000',
  },
  avatar: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
    borderBottom: '2px solid',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 700,
    color: '#94a3b8',
  },
  nameBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 6px 4px',
    background: 'linear-gradient(to top, #000000cc, transparent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 10,
    color: '#e2e8f0',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 90,
  },
  roleHint: {
    fontSize: 9,
    opacity: 0.55,
    fontWeight: 500,
  },
  statusIcons: {
    display: 'flex',
    gap: 2,
    alignItems: 'flex-end',
  },
  audioMeter: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 1,
    height: 12,
    marginRight: 2,
  },
  audioBar: {
    width: 2,
    borderRadius: 1,
    display: 'inline-block',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 10px 12px',
    borderTop: '1px solid #1a1a1a',
  },
  controlBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: '1px solid',
    background: '#111',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 10,
    color: '#475569',
    padding: '8px 4px',
    textAlign: 'center',
  },
  error: {
    fontSize: 10,
    color: '#f87171',
    padding: '8px 4px',
    lineHeight: 1.4,
  },
}
