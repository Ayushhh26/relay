// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-oidc-context', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import React from 'react'
import { useAuth } from 'react-oidc-context'
import { AuthGate } from '../../src/AuthGate'

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('AuthGate', () => {
  it('bypasses auth and renders children when VITE_AUTH_ENABLED is not true', () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'false')
    render(
      <MemoryRouter>
        <AuthGate><span>protected content</span></AuthGate>
      </MemoryRouter>
    )
    expect(screen.getByText('protected content')).toBeTruthy()
  })

  it('shows loading indicator when OIDC is loading', () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true')
    mockUseAuth.mockReturnValue({ isLoading: true, isAuthenticated: false })
    render(
      <MemoryRouter>
        <AuthGate><span>protected content</span></AuthGate>
      </MemoryRouter>
    )
    expect(screen.getByTestId('auth-loading')).toBeTruthy()
    expect(screen.queryByText('protected content')).toBeNull()
  })

  it('shows sign-in button when not authenticated', async () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true')
    const signinRedirect = vi.fn()
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false, signinRedirect })
    sessionStorage.clear()
    render(
      <MemoryRouter initialEntries={['/join/42?role=candidate']}>
        <AuthGate><span>protected content</span></AuthGate>
      </MemoryRouter>
    )
    const btn = screen.getByTestId('sign-in-btn')
    expect(btn).toBeTruthy()
    expect(screen.queryByText('protected content')).toBeNull()
    await userEvent.click(btn)
    expect(signinRedirect).toHaveBeenCalledOnce()
    expect(signinRedirect).toHaveBeenCalledWith({ state: '/join/42?role=candidate' })
    expect(sessionStorage.getItem('relay/auth-return-path')).toBe('/join/42?role=candidate')
  })

  it('renders children when authenticated', () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true')
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, user: { id_token: 'tok123' } })
    render(
      <MemoryRouter>
        <AuthGate><span>protected content</span></AuthGate>
      </MemoryRouter>
    )
    expect(screen.getByText('protected content')).toBeTruthy()
    expect(screen.queryByTestId('auth-loading')).toBeNull()
    expect(screen.queryByTestId('sign-in-btn')).toBeNull()
  })

  it('passes through on /callback so OIDC code exchange can complete', () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true')
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })
    render(
      <MemoryRouter initialEntries={['/callback']}>
        <AuthGate><span>callback handler</span></AuthGate>
      </MemoryRouter>
    )
    expect(screen.getByText('callback handler')).toBeTruthy()
    expect(screen.queryByTestId('sign-in-btn')).toBeNull()
  })

  it('passes through on /logout so sign-out page can render', () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true')
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })
    render(
      <MemoryRouter initialEntries={['/logout']}>
        <AuthGate><span>logout handler</span></AuthGate>
      </MemoryRouter>
    )
    expect(screen.getByText('logout handler')).toBeTruthy()
    expect(screen.queryByTestId('sign-in-btn')).toBeNull()
  })
})
