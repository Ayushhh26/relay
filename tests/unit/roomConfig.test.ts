import { describe, it, expect, vi, afterEach } from 'vitest'
import { isPresentParticipant } from '../../src/roomConfig'

afterEach(() => {
  vi.useRealTimers()
})

const NOW_MS = 1_000_000_000_000 // arbitrary fixed ms timestamp

function nowMicros(): bigint {
  return BigInt(NOW_MS) * 1000n
}

function participant(overrides: Partial<{ active: boolean; lastSeenAt: bigint }>) {
  return {
    active: true,
    lastSeenAt: nowMicros(),
    ...overrides,
  }
}

describe('isPresentParticipant', () => {
  it('returns false when inactive', () => {
    vi.setSystemTime(NOW_MS)
    expect(isPresentParticipant(participant({ active: false }))).toBe(false)
  })

  it('returns false when lastSeenAt is 0 (legacy / never heartbeated)', () => {
    vi.setSystemTime(NOW_MS)
    expect(isPresentParticipant(participant({ lastSeenAt: 0n }))).toBe(false)
  })

  it('returns true when active and recently heartbeated', () => {
    vi.setSystemTime(NOW_MS)
    expect(isPresentParticipant(participant({ lastSeenAt: nowMicros() - 5_000_000n }))).toBe(true)
  })

  it('returns false when heartbeat is older than 35 seconds', () => {
    vi.setSystemTime(NOW_MS)
    const stale = nowMicros() - 36_000_000n // 36s ago in micros
    expect(isPresentParticipant(participant({ lastSeenAt: stale }))).toBe(false)
  })

  it('returns true at exactly 34 seconds (within window)', () => {
    vi.setSystemTime(NOW_MS)
    const recent = nowMicros() - 34_000_000n
    expect(isPresentParticipant(participant({ lastSeenAt: recent }))).toBe(true)
  })
})
