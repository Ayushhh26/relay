export const VALID_ROLES = ['candidate', 'interviewer', 'observer'] as const
export type RoomRole = (typeof VALID_ROLES)[number]

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
  return role
}
