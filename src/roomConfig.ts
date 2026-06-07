export const VALID_ROLES = ['candidate', 'interviewer', 'observer'] as const
export type RoomRole = (typeof VALID_ROLES)[number]

export const STUDY_ROLES = ['host', 'member'] as const
export type StudyRole = (typeof STUDY_ROLES)[number]

export function isStudyRoom(kind?: string): boolean {
  return kind === 'study'
}

export type StudyEditorMode = 'notepad' | 'code'

export function normalizeStudyEditorMode(value?: string | null): StudyEditorMode {
  return value === 'notepad' ? 'notepad' : 'code'
}

/** Study room with shared notes only — no Run, language picker, or terminal. */
export function isStudyNotepadRoom(room?: { kind?: string; editorMode?: string }): boolean {
  return isStudyRoom(room?.kind) && normalizeStudyEditorMode(room?.editorMode) === 'notepad'
}

export function studyEditorModeLabel(mode: StudyEditorMode): string {
  return mode === 'notepad' ? 'Notepad' : 'Code editor'
}

export function validRolesForKind(kind?: string): string[] {
  return isStudyRoom(kind) ? [...STUDY_ROLES] : [...VALID_ROLES]
}

const PRESENCE_STALE_MICROS = 35_000_000n

export function isPresentParticipant(
  p: { active: boolean; lastSeenAt: bigint }
): boolean {
  if (!p.active) return false
  if ((p.lastSeenAt ?? 0n) === 0n) return false
  const nowMicros = BigInt(Date.now()) * 1000n
  return nowMicros - p.lastSeenAt < PRESENCE_STALE_MICROS
}

export function roleLabel(role: string): string {
  if (role === 'candidate') return 'Candidate'
  if (role === 'interviewer') return 'Interviewer'
  if (role === 'observer') return 'Observer'
  if (role === 'host') return 'Host'
  if (role === 'member') return 'Member'
  return role
}

export function isRoomClosed(room?: { closedAt?: bigint } | null): boolean {
  return (room?.closedAt ?? 0n) > 0n
}

export function canCloseRoom(role: string, kind?: string): boolean {
  return isStudyRoom(kind) ? role === 'host' : role === 'interviewer'
}

export function sessionExitLabel(kind?: string): string {
  return isStudyRoom(kind) ? 'Exit session' : 'Exit interview'
}

export function sessionCloseLabel(kind?: string): string {
  return isStudyRoom(kind) ? 'Close session' : 'Close interview'
}
