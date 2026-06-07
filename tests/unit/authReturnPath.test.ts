// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { resolveAuthReturnPath, sanitizeReturnPath } from '../../src/authReturnPath'

describe('authReturnPath', () => {
  it('prefers OIDC state over sessionStorage', () => {
    sessionStorage.setItem('relay/auth-return-path', '/')
    expect(resolveAuthReturnPath('/join/42?role=candidate')).toBe('/join/42?role=candidate')
    expect(sessionStorage.getItem('relay/auth-return-path')).toBe('/')
  })

  it('falls back to sessionStorage when OIDC state is missing', () => {
    sessionStorage.setItem('relay/auth-return-path', '/join/99?role=observer')
    expect(resolveAuthReturnPath(undefined)).toBe('/join/99?role=observer')
    expect(sessionStorage.getItem('relay/auth-return-path')).toBeNull()
  })

  it('rejects external redirect targets', () => {
    expect(sanitizeReturnPath('https://evil.com')).toBe('/')
    expect(sanitizeReturnPath('//evil.com')).toBe('/')
  })
})
