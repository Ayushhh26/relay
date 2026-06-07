// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
    render(<AuthGate><span>protected content</span></AuthGate>)
    expect(screen.getByText('protected content')).toBeTruthy()
  })

  it('shows loading indicator when OIDC is loading', () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true')
    mockUseAuth.mockReturnValue({ isLoading: true, isAuthenticated: false })
    render(<AuthGate><span>protected content</span></AuthGate>)
    expect(screen.getByTestId('auth-loading')).toBeTruthy()
    expect(screen.queryByText('protected content')).toBeNull()
  })

  it('shows sign-in button when not authenticated', async () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true')
    const signinRedirect = vi.fn()
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false, signinRedirect })
    render(<AuthGate><span>protected content</span></AuthGate>)
    const btn = screen.getByTestId('sign-in-btn')
    expect(btn).toBeTruthy()
    expect(screen.queryByText('protected content')).toBeNull()
    await userEvent.click(btn)
    expect(signinRedirect).toHaveBeenCalledOnce()
  })

  it('renders children when authenticated', () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true')
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, user: { id_token: 'tok123' } })
    render(<AuthGate><span>protected content</span></AuthGate>)
    expect(screen.getByText('protected content')).toBeTruthy()
    expect(screen.queryByTestId('auth-loading')).toBeNull()
    expect(screen.queryByTestId('sign-in-btn')).toBeNull()
  })
})
