import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import {
  AuthBrand,
  AuthCard,
  AuthErrorMessage,
  AuthFooterNote,
  AuthLayout,
  AuthPrimaryButton,
  AuthSecondaryButton,
  AuthSpinner,
  AUTH_ENABLED,
} from './authUi'

type LogoutPhase = 'working' | 'done' | 'error'

/** Signs the user out and shows a themed confirmation screen. */
export function AuthLogout() {
  const auth = useAuth()
  const started = useRef(false)
  const [phase, setPhase] = useState<LogoutPhase>(AUTH_ENABLED ? 'working' : 'done')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!AUTH_ENABLED) return
    if (started.current) return
    started.current = true

    if (!auth.isAuthenticated) {
      setPhase('done')
      return
    }

    void (async () => {
      try {
        await auth.signoutRedirect({
          post_logout_redirect_uri: `${window.location.origin}/logout`,
        })
      } catch (e) {
        try {
          await auth.removeUser()
          setPhase('done')
        } catch {
          setError(e instanceof Error ? e.message : 'Could not sign out')
          setPhase('error')
        }
      }
    })()
  }, [auth])

  if (!AUTH_ENABLED || phase === 'done') {
    return (
      <AuthLayout testId="auth-logout">
        <AuthCard>
          <AuthBrand subtitle="Signed out" />
          <p className="auth-copy">You have been signed out of Relay.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            <Link to="/" className="auth-btn auth-btn--primary auth-btn--link" data-testid="return-home-link">
              Return to Relay
            </Link>
          </div>
          <AuthFooterNote>Sign in again anytime to create or join sessions.</AuthFooterNote>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (phase === 'error') {
    return (
      <AuthLayout testId="auth-logout">
        <AuthCard>
          <AuthBrand subtitle="Sign out" />
          {error && <AuthErrorMessage message={error} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <AuthPrimaryButton testId="sign-out-retry-btn" onClick={() => window.location.reload()}>
              Try again
            </AuthPrimaryButton>
            <AuthSecondaryButton testId="return-home-btn" onClick={() => { window.location.href = '/' }}>
              Return home
            </AuthSecondaryButton>
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout testId="auth-logout">
      <AuthCard>
        <AuthBrand subtitle="Signing out" />
        <AuthSpinner label="Signing you out…" />
      </AuthCard>
    </AuthLayout>
  )
}
