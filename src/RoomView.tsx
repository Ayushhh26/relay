import { useRef, useState, useEffect, lazy, Suspense } from 'react'

import { useParams, useNavigate } from 'react-router-dom'

import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react'

import { tables, reducers } from './module_bindings'

import { Editor } from './Editor'

const NotepadEditor = lazy(() =>
  import('./NotepadEditor').then(m => ({ default: m.NotepadEditor }))
)

import { AssistPanel } from './AssistPanel'

import { RunPanel } from './RunPanel'

import { VideoSidebar } from './VideoSidebar'

import { QuestionPanel } from './QuestionPanel'

import { QuestionPicker } from './QuestionPicker'

import { RoomHeader } from './RoomHeader'

import {

  getQuestionById,

  getQuestionHarness,

  getQuestionStarter,

  INTERVIEW_QUESTIONS,

} from './problem'

import {
  CODE_LANGUAGES,
  languageFileName,
  languageLabel,
  normalizeLanguage,
} from './languages'

import { isPresentParticipant, isStudyRoom, isStudyNotepadRoom, isRoomClosed } from './roomConfig'

import { loadRoomMembership, clearRoomMembership } from './roomMembership'

import { useVideoCall } from './useVideoCall'

import { runCode } from './runCode'



export function RoomView() {

  const { roomId: roomIdStr } = useParams<{ roomId: string }>()

  const ROOM_ID = BigInt(roomIdStr!)



  const navigate = useNavigate()

  const { isActive, identity } = useSpacetimeDB()

  const myIdentityHex = identity?.toHexString() ?? ''

  const updateDocument = useReducer(reducers.updateDocument)

  const setDocumentLanguage = useReducer(reducers.setDocumentLanguage)

  const appendRunOutput = useReducer(reducers.appendRunOutput)

  const clearRunOutput = useReducer(reducers.clearRunOutput)

  const heartbeat = useReducer(reducers.heartbeat)

  const leaveRoom = useReducer(reducers.leaveRoom)

  const closeRoom = useReducer(reducers.closeRoom)

  const joinRoom = useReducer(reducers.joinRoom)

  const selectInterviewQuestion = useReducer(reducers.selectInterviewQuestion)



  const [rooms] = useTable(tables.room)

  const [docs] = useTable(tables.document)

  const [participants, participantsReady] = useTable(tables.participant)

  const [runOutputs] = useTable(tables.runOutput)



  const currentRoom = rooms.find(r => r.id === ROOM_ID)

  const remoteDoc = docs.find(d => d.roomId === ROOM_ID)

  const activeParticipants = participants.filter(

    p => p.roomId === ROOM_ID && isPresentParticipant(p)

  )

  const roomOutputs = runOutputs.filter(r => r.roomId === ROOM_ID)



  const isStudy = isStudyRoom(currentRoom?.kind)
  const isNotepad = isStudyNotepadRoom(currentRoom)
  const showCodeEditor = !isNotepad

  const selectedQuestion = getQuestionById(currentRoom?.selectedQuestionId)

  const docLanguage = normalizeLanguage(remoteDoc?.language)



  const myParticipant = activeParticipants.find(

    p => p.identity.toHexString() === myIdentityHex

  )

  const canPickQuestion = !isStudy && (

    myParticipant?.role === 'interviewer' || myParticipant?.role === 'observer'

  )

  const canEditDoc = isStudy ? !!myParticipant : myParticipant?.role === 'candidate'

  const canAsk = canEditDoc

  const policy = currentRoom?.policy || 'syntax-only'



  const [localContent, setLocalContent] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasPendingWrite = useRef(false)
  const hasRejoined = useRef(false)
  const hasLeftSession = useRef(false)



  const videoCall = useVideoCall({

    roomId: ROOM_ID,

    enabled: isActive && !!myParticipant,

    localRole: myParticipant?.role ?? '',

  })



  useEffect(() => {

    if (!isActive || !myParticipant) return

    heartbeat({ roomId: ROOM_ID })

    const id = window.setInterval(() => heartbeat({ roomId: ROOM_ID }), 10_000)

    return () => window.clearInterval(id)

  }, [isActive, !!myParticipant])



  useEffect(() => {

    if (!isActive || !myParticipant) return

    const onLeave = () => leaveRoom({ roomId: ROOM_ID })

    window.addEventListener('pagehide', onLeave)

    return () => window.removeEventListener('pagehide', onLeave)

  }, [isActive, !!myParticipant])



  useEffect(() => {
    if (!isActive || !participantsReady || hasLeftSession.current) return
    if (currentRoom && isRoomClosed(currentRoom)) {
      hasLeftSession.current = true
      clearRoomMembership(ROOM_ID)
      navigate('/', { replace: true })
    }
  }, [isActive, participantsReady, currentRoom?.closedAt, ROOM_ID, navigate])



  function handleExitSession() {
    if (hasLeftSession.current) return
    hasLeftSession.current = true
    leaveRoom({ roomId: ROOM_ID })
    clearRoomMembership(ROOM_ID)
    navigate('/', { replace: true })
  }

  function handleCloseSession() {
    if (hasLeftSession.current) return
    hasLeftSession.current = true
    closeRoom({ roomId: ROOM_ID })
    clearRoomMembership(ROOM_ID)
    navigate('/', { replace: true })
  }



  useEffect(() => {

    if (remoteDoc && !hasPendingWrite.current) {

      setLocalContent(remoteDoc.content)

    }

  }, [remoteDoc?.content, remoteDoc?.language])



  useEffect(() => {
    if (!isActive || !participantsReady || hasRejoined.current) return
    if (myParticipant) { hasRejoined.current = true; return }

    const saved = loadRoomMembership(ROOM_ID)
    if (!saved) {
      navigate(`/join/${String(ROOM_ID)}`, { replace: true })
      return
    }

    hasRejoined.current = true
    void (async () => {
      try {
        await joinRoom({ roomId: ROOM_ID, displayName: saved.displayName, role: saved.role })
      } catch (e) {
        hasRejoined.current = false
        setJoinError(e instanceof Error ? e.message : 'Failed to join room')
      }
    })()
  }, [isActive, participantsReady, myParticipant, ROOM_ID, joinRoom, navigate])



  async function handleRun() {

    if (isRunning) return

    clearRunOutput({ roomId: ROOM_ID })

    setIsRunning(true)



    const harness = isStudy

      ? undefined

      : getQuestionHarness(selectedQuestion, docLanguage)



    if (docLanguage === 'python') {

      appendRunOutput({ roomId: ROOM_ID, seq: 0n, stream: 'stdout', text: 'Loading Python runtime…' })

    }



    try {

      const result = await runCode(docLanguage, editorValue, harness)

      clearRunOutput({ roomId: ROOM_ID })

      let seq = 0n

      for (const { stream, text } of result.logs) {

        appendRunOutput({ roomId: ROOM_ID, seq, stream, text })

        seq++

      }

      if (result.error) {

        appendRunOutput({ roomId: ROOM_ID, seq, stream: 'stderr', text: result.error })

      }

    } catch (err) {

      clearRunOutput({ roomId: ROOM_ID })

      appendRunOutput({ roomId: ROOM_ID, seq: 0n, stream: 'stderr', text: String(err) })

    } finally {

      setIsRunning(false)

    }

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



  function handleLanguageChange(nextRaw: string) {

    const next = normalizeLanguage(nextRaw)

    if (next === docLanguage) return

    const starter = getQuestionStarter(selectedQuestion, next, isStudy)

    setLocalContent(starter)

    hasPendingWrite.current = false

    setDocumentLanguage({ roomId: ROOM_ID, language: next, content: starter })

  }



  function handleSelectQuestion(question: typeof INTERVIEW_QUESTIONS[number]) {

    const starter = question.templates[docLanguage].starterCode

    selectInterviewQuestion({

      roomId: ROOM_ID,

      questionId: question.id,

      starterCode: starter,

    })

    setLocalContent(starter)

    hasPendingWrite.current = false

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
    const saved = loadRoomMembership(ROOM_ID)
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#111', minHeight: '100vh', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span data-testid="connection-status" style={{ color: '#4ade80' }}>Connected</span>
        {joinError ? (
          <>
            <span data-testid="room-join-error" style={{ color: '#f87171', fontSize: 14 }}>{joinError}</span>
            <button
              type="button"
              onClick={() => navigate(`/join/${String(ROOM_ID)}?role=${saved?.role ?? 'candidate'}`, { replace: true })}
              style={{ padding: '8px 14px', borderRadius: 6, background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}
            >
              Back to join
            </button>
          </>
        ) : (
          <span style={{ opacity: 0.4, fontSize: 13 }}>Loading room…</span>
        )}
      </div>
    )
  }



  return (

    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', background: '#111', color: '#e2e8f0' }}>

      {/* Hidden — keeps connection-status in DOM for E2E tests after room loads */}
      <span data-testid="connection-status" style={{ display: 'none' }}>Connected</span>

      <RoomHeader

        roomTitle={currentRoom?.title ?? ''}

        roomId={ROOM_ID}

        roomKind={currentRoom?.kind ?? 'interview'}

        participants={activeParticipants}

        myRole={myParticipant.role}

        canRun={canEditDoc && showCodeEditor && !isRunning}

        onRun={() => { void handleRun() }}

        onExit={handleExitSession}

        onClose={handleCloseSession}

      />



      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        <VideoSidebar call={videoCall} />



        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#0d0d0d' }}>

          {!isStudy && (

            <>

              <QuestionPanel question={selectedQuestion} />

              {canPickQuestion && (

                <QuestionPicker

                  questions={INTERVIEW_QUESTIONS}

                  selectedQuestionId={currentRoom?.selectedQuestionId ?? ''}

                  onSelect={handleSelectQuestion}

                />

              )}

            </>

          )}



          <div style={{ flex: showCodeEditor ? '1 1 58%' : 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={editorTabStyles.bar}>
              <span style={editorTabStyles.tab}>
                {isNotepad ? 'Notes' : languageFileName(docLanguage)}
              </span>
              {showCodeEditor && (
                <div style={editorTabStyles.right}>
                  <select
                    data-testid="language-select"
                    value={docLanguage}
                    onChange={e => handleLanguageChange(e.target.value)}
                    disabled={!canEditDoc}
                    style={editorTabStyles.select}
                  >
                    {CODE_LANGUAGES.map(lang => (
                      <option key={lang} value={lang}>{languageLabel(lang)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {isNotepad ? (
                <Suspense fallback={<div style={{ flex: 1, padding: 16, opacity: 0.4, fontSize: 13 }}>Loading editor…</div>}>
                  <NotepadEditor
                    value={editorValue}
                    onChange={canEditDoc ? handleChange : undefined}
                    readOnly={!canEditDoc}
                  />
                </Suspense>
              ) : (
                <Editor
                  value={editorValue}
                  onChange={canEditDoc ? handleChange : undefined}
                  readOnly={!canEditDoc}
                />
              )}
            </div>
          </div>

          {showCodeEditor && (
            <div style={{ flex: '0 0 38%', minHeight: 140, borderTop: '1px solid #1a1a1a' }}>
              <RunPanel outputs={roomOutputs} isRunning={isRunning} />
            </div>
          )}

        </div>



        <div style={{ width: 360, minWidth: 300, minHeight: 0 }}>

          <AssistPanel

            roomId={ROOM_ID}

            policy={policy}

            canAsk={canAsk}

            roomKind={currentRoom?.kind ?? 'interview'}

            code={editorValue}

            runOutput={roomOutputs}

            roomTitle={currentRoom?.title ?? ''}

            myRole={myParticipant.role}

          />

        </div>

      </div>

    </div>

  )

}



const editorTabStyles = {

  bar: {

    display: 'flex',

    alignItems: 'center',

    justifyContent: 'space-between',

    padding: '8px 12px',

    background: '#141414',

    borderBottom: '1px solid #1a1a1a',

  } as const,

  tab: {

    fontSize: 12,

    fontWeight: 600,

    color: '#e2e8f0',

  } as const,

  right: {

    display: 'flex',

    alignItems: 'center',

    gap: 8,

  } as const,

  select: {

    padding: '4px 8px',

    borderRadius: 6,

    fontSize: 11,

    background: '#1a1a1a',

    border: '1px solid #333',

    color: '#e2e8f0',

    cursor: 'pointer',

  } as const,

}


