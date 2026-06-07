import type { Participant } from './module_bindings/types'

const params = new URLSearchParams(window.location.search)

export const ROOM_ID = BigInt(params.get('room') ?? '1')
export const ROLE_PARAM = params.get('role')
export const VALID_ROLES = ['candidate', 'interviewer', 'observer'] as const
export type RoomRole = (typeof VALID_ROLES)[number]

export const HAS_VALID_ROLE = VALID_ROLES.includes(ROLE_PARAM as RoomRole)
export const ROLE: RoomRole | '' = HAS_VALID_ROLE ? (ROLE_PARAM as RoomRole) : ''
export const NAME = params.get('name') ?? (ROLE || 'Guest')
export const POLICY = params.get('policy') ?? 'open'
export const IS_CANDIDATE = ROLE === 'candidate'

/** Hide participants whose heartbeat expired (ghost tabs / stale observer rows). */
const PRESENCE_STALE_MICROS = 35_000_000n

export function isPresentParticipant(p: Pick<Participant, 'active' | 'lastSeenAt'>): boolean {
  if (!p.active) return false
  if (p.lastSeenAt === 0n) return false
  const nowMicros = BigInt(Date.now()) * 1000n
  return nowMicros - p.lastSeenAt < PRESENCE_STALE_MICROS
}

export function roleLabel(role: string): string {
  if (role === 'candidate') return 'Candidate'
  if (role === 'interviewer') return 'Interviewer'
  if (role === 'observer') return 'Observer'
  return role
}
