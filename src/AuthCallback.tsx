import { useEffect, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { resolveAuthReturnPath } from './authReturnPath'

const centerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
  background: '#111',
  color: '#e2e8f0',
  fontFamily: 'sans-serif',
  gap: 12,
}

/** Completes the OIDC redirect and sends the user back to their intended page. */
export function AuthCallback() {
  const auth = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate(resolveAuthReturnPath(auth.user?.state), { replace: true })
    }
  }, [auth.isAuthenticated, auth.user, navigate])

  if (auth.error) {
    return (
      <div style={centerStyle}>
        <p data-testid="auth-error">Sign-in failed: {auth.error.message}</p>
        <button data-testid="sign-in-btn" onClick={() => auth.signinRedirect()}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <div style={centerStyle} data-testid="auth-callback">
      <span data-testid="auth-loading">Completing sign-in…</span>
    </div>
  )
}
