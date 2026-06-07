import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Identity } from 'spacetimedb'
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react'
import { reducers, tables } from './module_bindings'
import type { SignalingMessage } from './module_bindings/types'
import { ICE_SERVERS } from './videoConfig'
import { isPresentParticipant } from './roomConfig'
import { useAudioLevel } from './useAudioLevel'

export interface VideoParticipant {
  identity: string
  displayName: string
  role: string
  stream: MediaStream | null
  localTrack: MediaStreamTrack | null
  streamKey: string
  audioLevel: number
  muted: boolean
  videoOff: boolean
  isLocal: boolean
}

export interface UseVideoCallReturn {
  participants: VideoParticipant[]
  isMuted: boolean
  isVideoOff: boolean
  videoError: string | null
  isVideoReady: boolean
  toggleMute: () => void
  toggleVideo: () => void
  localAudioLevel: number
}

const ROLE_ORDER: Record<string, number> = {
  interviewer: 0,
  candidate: 1,
  observer: 2,
}

interface UseVideoCallProps {
  roomId: bigint
  enabled: boolean
  localRole: string
}

function identityHex(identity: Identity): string {
  return identity.toHexString()
}

function stopTrack(track: MediaStreamTrack | null | undefined) {
  if (track && track.readyState !== 'ended') {
    track.stop()
  }
}

/** Remote recv tracks stay "live" when the sender mutes or replaceTrack(null). */
export function isActiveVideoTrack(track: MediaStreamTrack): boolean {
  return track.kind === 'video' && track.readyState === 'live' && !track.muted
}

function videoStreamKey(stream: MediaStream | null | undefined, localTrack: MediaStreamTrack | null | undefined): string {
  if (localTrack) {
    return `local:${localTrack.id}:${localTrack.readyState}:${localTrack.muted}`
  }
  if (!stream) return 'none'
  return stream.getVideoTracks()
    .map(t => `${t.id}:${t.readyState}:${t.muted}`)
    .join('|') || 'none'
}

export function useVideoCall({ roomId, enabled, localRole }: UseVideoCallProps): UseVideoCallReturn {
  const { identity, isActive } = useSpacetimeDB()
  const sendSignal = useReducer(reducers.sendSignal)
  const deleteSignal = useReducer(reducers.deleteSignal)
  const updateMediaState = useReducer(reducers.updateMediaState)

  const [dbParticipants] = useTable(tables.participant)
  const [signals] = useTable(tables.signalingMessage)

  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(() => new Map())
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [isVideoReady, setIsVideoReady] = useState(false)
  const [mediaEpoch, setMediaEpoch] = useState(0)
  const [remoteMediaRevision, setRemoteMediaRevision] = useState(0)

  const audioTrackRef = useRef<MediaStreamTrack | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const peerConns = useRef<Map<string, RTCPeerConnection>>(new Map())
  const peerIdentities = useRef<Map<string, Identity>>(new Map())
  const pendingIce = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const processedSignals = useRef<Set<string>>(new Set())
  const pendingSignals = useRef<SignalingMessage[]>([])
  const mediaStartedRef = useRef(false)
  const localTrackIdsRef = useRef<Set<string>>(new Set())
  const isVideoOffRef = useRef(false)
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const lastAudioLevelSent = useRef(-1)
  const liveLocalLevelRef = useRef(0)

  const myHex = identity?.toHexString() ?? null

  const roomPeers = useMemo(
    () => dbParticipants.filter(p => p.roomId === roomId && isPresentParticipant(p)),
    [dbParticipants, roomId],
  )

  const mySignals = useMemo(() => {
    if (!myHex) return []
    return signals.filter(
      s => s.roomId === roomId && identityHex(s.toIdentity) === myHex,
    )
  }, [signals, roomId, myHex])

  const registerLocalTrack = useCallback((track: MediaStreamTrack | null) => {
    if (track) {
      localTrackIdsRef.current.add(track.id)
    }
  }, [])

  const unregisterLocalTrack = useCallback((track: MediaStreamTrack | null | undefined) => {
    if (track) {
      localTrackIdsRef.current.delete(track.id)
    }
  }, [])

  const stopLocalVideo = useCallback(() => {
    const video = mediaStreamRef.current?.getVideoTracks()[0] ?? null
    if (video) {
      video.enabled = false
      unregisterLocalTrack(video)
      stopTrack(video)
      mediaStreamRef.current?.removeTrack(video)
    }
    setLocalVideoTrack(null)
  }, [unregisterLocalTrack])

  const isLocalMediaTrack = useCallback((track: MediaStreamTrack) => {
    if (localTrackIdsRef.current.has(track.id)) return true
    return mediaStreamRef.current?.getTracks().some(t => t.id === track.id) ?? false
  }, [])

  const bumpRemoteMedia = useCallback((peerId: string) => {
    setRemoteStreams(prev => {
      if (!prev.has(peerId)) return prev
      const next = new Map(prev)
      remoteStreamsRef.current = next
      return next
    })
    setRemoteMediaRevision(r => r + 1)
  }, [])

  const attachRemoteTrackListeners = useCallback(
    (peerId: string, track: MediaStreamTrack) => {
      const refresh = () => bumpRemoteMedia(peerId)
      track.addEventListener('mute', refresh)
      track.addEventListener('unmute', refresh)
      track.addEventListener('ended', refresh)
    },
    [bumpRemoteMedia],
  )

  const setRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    setRemoteStreams(prev => {
      const next = new Map(prev)
      next.set(peerId, stream)
      remoteStreamsRef.current = next
      return next
    })
  }, [])

  const removePeer = useCallback((peerId: string) => {
    peerConns.current.get(peerId)?.close()
    peerConns.current.delete(peerId)
    peerIdentities.current.delete(peerId)
    pendingIce.current.delete(peerId)
    setRemoteStreams(prev => {
      if (!prev.has(peerId)) return prev
      const next = new Map(prev)
      next.delete(peerId)
      remoteStreamsRef.current = next
      return next
    })
  }, [])

  const flushPendingIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingIce.current.get(peerId) ?? []
    pendingIce.current.delete(peerId)
    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    }
  }, [])

  const sendSignalMsg = useCallback(
    (toIdentity: Identity, msgType: string, payload: string) => {
      sendSignal({ roomId, toIdentity, msgType, payload })
    },
    [roomId, sendSignal],
  )

  const replaceAudioTrackOnPeers = useCallback(async (track: MediaStreamTrack | null) => {
    for (const pc of peerConns.current.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio')
      if (sender) {
        await sender.replaceTrack(track)
      } else if (track && mediaStreamRef.current) {
        pc.addTrack(track, mediaStreamRef.current)
      }
    }
  }, [])

  const replaceVideoTrackOnPeers = useCallback(async (track: MediaStreamTrack | null) => {
    for (const pc of peerConns.current.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video')
      if (sender) {
        await sender.replaceTrack(track)
      } else if (track && mediaStreamRef.current) {
        pc.addTrack(track, mediaStreamRef.current)
      }
    }
  }, [])

  const createPeerConnection = useCallback(
    (peerId: string, peerIdentity: Identity): RTCPeerConnection => {
      const existing = peerConns.current.get(peerId)
      if (existing) return existing

      peerIdentities.current.set(peerId, peerIdentity)

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      const remoteStream = new MediaStream()
      const stream = mediaStreamRef.current

      if (stream) {
        for (const track of stream.getTracks()) {
          if (track.readyState === 'live') {
            pc.addTrack(track, stream)
          }
        }
      }

      pc.ontrack = (event) => {
        const track = event.track
        if (!track || isLocalMediaTrack(track)) return

        if (!remoteStream.getTracks().some(t => t.id === track.id)) {
          remoteStream.addTrack(track)
        }
        attachRemoteTrackListeners(peerId, track)
        setRemoteStream(peerId, remoteStream)
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalMsg(peerIdentity, 'ice', JSON.stringify(event.candidate.toJSON()))
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          removePeer(peerId)
        }
      }

      peerConns.current.set(peerId, pc)
      return pc
    },
    [attachRemoteTrackListeners, isLocalMediaTrack, removePeer, sendSignalMsg, setRemoteStream],
  )

  const callPeer = useCallback(
    async (peerId: string, peerIdentity: Identity) => {
      if (!myHex || peerId === myHex) return
      if (!mediaStreamRef.current) return

      let pc = peerConns.current.get(peerId)
      if (!pc) {
        pc = createPeerConnection(peerId, peerIdentity)
      }

      const remote = remoteStreamsRef.current.get(peerId)
      const hasRemoteVideo = remote?.getVideoTracks().some(isActiveVideoTrack) ?? false
      const hasRemoteAudio = remote?.getAudioTracks().some(t => t.readyState === 'live' && !t.muted) ?? false

      if (pc.signalingState === 'stable') {
        if (hasRemoteVideo && hasRemoteAudio) return
      } else if (pc.localDescription && pc.signalingState !== 'have-local-offer') {
        return
      } else if (pc.localDescription && pc.signalingState === 'have-local-offer') {
        return
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendSignalMsg(peerIdentity, 'offer', JSON.stringify(offer))
    },
    [createPeerConnection, myHex, sendSignalMsg],
  )

  const answerOffer = useCallback(
    async (fromId: string, fromIdentity: Identity, offerPayload: string) => {
      let pc = peerConns.current.get(fromId)
      if (!pc) {
        pc = createPeerConnection(fromId, fromIdentity)
      }

      const offer = JSON.parse(offerPayload) as RTCSessionDescriptionInit
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      await flushPendingIce(fromId, pc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendSignalMsg(fromIdentity, 'answer', JSON.stringify(answer))
    },
    [createPeerConnection, flushPendingIce, sendSignalMsg],
  )

  const handleSignal = useCallback(
    async (msg: SignalingMessage) => {
      const fromId = identityHex(msg.fromIdentity)
      if (!myHex || fromId === myHex) return

      if (msg.msgType === 'offer') {
        await answerOffer(fromId, msg.fromIdentity, msg.payload)
      } else if (msg.msgType === 'answer') {
        const pc = peerConns.current.get(fromId)
        if (pc) {
          const answer = JSON.parse(msg.payload) as RTCSessionDescriptionInit
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(answer))
            await flushPendingIce(fromId, pc)
          }
        }
      } else if (msg.msgType === 'ice') {
        const pc = peerConns.current.get(fromId)
        const candidate = JSON.parse(msg.payload) as RTCIceCandidateInit
        if (pc?.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } else {
          const queue = pendingIce.current.get(fromId) ?? []
          queue.push(candidate)
          pendingIce.current.set(fromId, queue)
        }
      }

      deleteSignal({ signalId: msg.id })
    },
    [answerOffer, deleteSignal, flushPendingIce, myHex],
  )

  const connectToAllPeers = useCallback(() => {
    if (!myHex || !mediaStreamRef.current) return

    const activeIds = new Set<string>()

    for (const peer of roomPeers) {
      const peerId = identityHex(peer.identity)
      if (peerId === myHex) continue
      activeIds.add(peerId)

      if (myHex < peerId) {
        const pc = peerConns.current.get(peerId)
        const state = pc?.connectionState
        const remote = remoteStreamsRef.current.get(peerId)
        const hasRemoteVideo = remote?.getVideoTracks().some(isActiveVideoTrack) ?? false
        const hasRemoteAudio = remote?.getAudioTracks().some(t => t.readyState === 'live' && !t.muted) ?? false
        if (!state || state === 'new' || state === 'failed' || state === 'disconnected') {
          void callPeer(peerId, peer.identity)
        } else if (state === 'connected' && (!hasRemoteVideo || !hasRemoteAudio)) {
          void callPeer(peerId, peer.identity)
        }
      }
    }

    for (const peerId of peerConns.current.keys()) {
      if (!activeIds.has(peerId)) {
        removePeer(peerId)
      }
    }
  }, [roomPeers, myHex, callPeer, removePeer])

  const flushPendingSignalQueue = useCallback(async () => {
    if (!mediaStreamRef.current) return
    const queued = pendingSignals.current.splice(0)
    for (const msg of queued) {
      const key = String(msg.id)
      if (processedSignals.current.has(key)) continue
      processedSignals.current.add(key)
      try {
        await handleSignal(msg)
      } catch (err) {
        console.error('WebRTC signal error:', err)
      }
    }
  }, [handleSignal])

  const stopAllMedia = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach(t => {
      unregisterLocalTrack(t)
      stopTrack(t)
    })
    mediaStreamRef.current = null
    audioTrackRef.current = null
    localTrackIdsRef.current.clear()
    setLocalVideoTrack(null)
  }, [unregisterLocalTrack])

  // Acquire camera + mic once
  useEffect(() => {
    if (!enabled || !isActive || !identity) return

    if (mediaStreamRef.current) {
      const vt = mediaStreamRef.current.getVideoTracks()[0] ?? null
      setLocalVideoTrack(isVideoOff ? null : vt)
      setIsVideoReady(true)
      return
    }

    if (mediaStartedRef.current) return
    mediaStartedRef.current = true

    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: true })
      .then(async stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => stopTrack(t))
          return
        }

        const videoTrack = stream.getVideoTracks()[0] ?? null
        const audioTrack = stream.getAudioTracks()[0] ?? null

        mediaStreamRef.current = stream
        audioTrackRef.current = audioTrack

        if (isVideoOffRef.current) {
          if (videoTrack) {
            unregisterLocalTrack(videoTrack)
            stopTrack(videoTrack)
            stream.removeTrack(videoTrack)
          }
          setLocalVideoTrack(null)
        } else {
          registerLocalTrack(videoTrack)
          setLocalVideoTrack(videoTrack)
        }

        setIsVideoReady(true)
        setVideoError(null)
        setMediaEpoch(e => e + 1)
      })
      .catch(err => {
        mediaStartedRef.current = false
        if (!cancelled) {
          setVideoError(err instanceof Error ? err.message : String(err))
          setIsVideoReady(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled, isActive, identity, isVideoOff, registerLocalTrack, unregisterLocalTrack])

  // Release hardware when camera is turned off
  useEffect(() => {
    isVideoOffRef.current = isVideoOff
    if (!isVideoOff || !mediaStreamRef.current) return
    stopLocalVideo()
    void replaceVideoTrackOnPeers(null).catch(err => {
      console.error('Failed to stop video on peers:', err)
    })
  }, [isVideoOff, stopLocalVideo, replaceVideoTrackOnPeers])

  useEffect(() => {
    return () => {
      stopAllMedia()
      peerConns.current.forEach(pc => pc.close())
      peerConns.current.clear()
      peerIdentities.current.clear()
    }
  }, [stopAllMedia])

  // When media is ready, flush queued signals and connect to peers
  useEffect(() => {
    if (!isVideoReady || !mediaStreamRef.current) return
    void flushPendingSignalQueue().then(() => {
      connectToAllPeers()
    })
  }, [isVideoReady, mediaEpoch, roomPeers, flushPendingSignalQueue, connectToAllPeers])

  // Process live signaling messages
  useEffect(() => {
    if (!myHex) return

    for (const msg of mySignals) {
      const key = String(msg.id)
      if (processedSignals.current.has(key)) continue

      if (!mediaStreamRef.current) {
        pendingSignals.current.push(msg)
        processedSignals.current.add(key)
        continue
      }

      processedSignals.current.add(key)
      void handleSignal(msg).catch(err => {
        console.error('WebRTC signal error:', err)
      })
    }
  }, [mySignals, myHex, handleSignal])

  const previewTrack = useMemo(() => {
    if (isVideoOff) return null
    if (localVideoTrack && localVideoTrack.readyState === 'live') return localVideoTrack
    return mediaStreamRef.current?.getVideoTracks().find(t => t.readyState === 'live') ?? null
  }, [isVideoOff, localVideoTrack, mediaEpoch])

  const localAudioTrack = useMemo(() => {
    const track = audioTrackRef.current ?? mediaStreamRef.current?.getAudioTracks()[0] ?? null
    if (!track || track.readyState !== 'live') return null
    return track
  }, [isVideoReady, mediaEpoch, isMuted])

  const liveLocalLevel = useAudioLevel(localAudioTrack, !isMuted)
  liveLocalLevelRef.current = liveLocalLevel

  const syncAudioLevelByte = useCallback(() => {
    if (isMuted) return 0
    return Math.min(100, Math.round(liveLocalLevelRef.current * 100))
  }, [isMuted])

  useEffect(() => {
    if (!enabled || !isActive) return

    const byte = syncAudioLevelByte()
    if (byte === lastAudioLevelSent.current) return

    const timer = setTimeout(() => {
      lastAudioLevelSent.current = byte
      updateMediaState({ roomId, muted: isMuted, videoOff: isVideoOff, audioLevel: byte })
    }, 120)

    return () => clearTimeout(timer)
  }, [liveLocalLevel, isMuted, isVideoOff, enabled, isActive, roomId, syncAudioLevelByte, updateMediaState])

  const allParticipants = useMemo<VideoParticipant[]>(() => {
    if (!myHex) return []

    const localTile: VideoParticipant = {
      identity: myHex,
      displayName: 'You',
      role: localRole,
      stream: null,
      localTrack: previewTrack,
      streamKey: videoStreamKey(null, previewTrack),
      audioLevel: liveLocalLevel,
      muted: isMuted,
      videoOff: isVideoOff,
      isLocal: true,
    }

    const remotes = roomPeers
      .filter(p => identityHex(p.identity) !== myHex)
      .slice()
      .sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
      .map(p => {
        const id = identityHex(p.identity)
        const stream = remoteStreams.get(id) ?? null
        return {
          identity: id,
          displayName: p.displayName,
          role: p.role,
          stream,
          localTrack: null,
          streamKey: videoStreamKey(stream, null),
          audioLevel: Number(p.audioLevel) / 100,
          muted: p.muted,
          videoOff: p.videoOff,
          isLocal: false,
        }
      })

    return [localTile, ...remotes]
  }, [roomPeers, myHex, remoteStreams, remoteMediaRevision, previewTrack, liveLocalLevel, isMuted, isVideoOff, localRole])

  const toggleMute = useCallback(() => {
    const audio = audioTrackRef.current
    if (!audio) return
    const next = !isMuted
    audio.enabled = !next
    setIsMuted(next)
    const audioLevel = next ? 0 : syncAudioLevelByte()
    lastAudioLevelSent.current = audioLevel
    updateMediaState({ roomId, muted: next, videoOff: isVideoOff, audioLevel })
    void replaceAudioTrackOnPeers(next ? null : audio).catch(err => {
      console.error('Failed to update audio on peers:', err)
    })
  }, [isMuted, isVideoOff, roomId, replaceAudioTrackOnPeers, updateMediaState, syncAudioLevelByte])

  const toggleVideo = useCallback(async () => {
    try {
      if (!isVideoOff) {
        setIsVideoOff(true)
        isVideoOffRef.current = true
        const audioLevel = syncAudioLevelByte()
        lastAudioLevelSent.current = audioLevel
        updateMediaState({ roomId, muted: isMuted, videoOff: true, audioLevel })
        stopLocalVideo()
        try {
          await replaceVideoTrackOnPeers(null)
        } catch (err) {
          console.error('Failed to stop video on peers:', err)
        }
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      const videoTrack = stream.getVideoTracks()[0]
      if (!videoTrack) throw new Error('No camera track available')

      if (!mediaStreamRef.current) {
        mediaStreamRef.current = new MediaStream()
      }
      mediaStreamRef.current.addTrack(videoTrack)
      registerLocalTrack(videoTrack)
      if (audioTrackRef.current && !mediaStreamRef.current.getAudioTracks().includes(audioTrackRef.current)) {
        mediaStreamRef.current.addTrack(audioTrackRef.current)
      }

      setLocalVideoTrack(videoTrack)
      setIsVideoOff(false)
      isVideoOffRef.current = false
      const audioLevel = syncAudioLevelByte()
      lastAudioLevelSent.current = audioLevel
      updateMediaState({ roomId, muted: isMuted, videoOff: false, audioLevel })

      try {
        await replaceVideoTrackOnPeers(videoTrack)
      } catch (err) {
        console.error('Failed to resume video on peers:', err)
      }
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : String(err))
    }
  }, [isMuted, isVideoOff, registerLocalTrack, replaceVideoTrackOnPeers, roomId, stopLocalVideo, updateMediaState, syncAudioLevelByte])

  return {
    participants: allParticipants,
    isMuted,
    isVideoOff,
    videoError,
    isVideoReady,
    toggleMute,
    toggleVideo,
    localAudioLevel: liveLocalLevel,
  }
}
