import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { saveAuthReturnPath } from './authReturnPath'

interface Props {
  children: ReactNode
}

const centerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
  background: '#111',
  color: '#e2e8f0',
  fontFamily: 'sans-serif',
}

export function AuthGate({ children }: Props) {
  if (import.meta.env.VITE_AUTH_ENABLED !== 'true') {
    return <>{children}</>
  }
  return <AuthGateOIDC>{children}</AuthGateOIDC>
}

function AuthGateOIDC({ children }: Props) {
  const auth = useAuth()
  const { pathname, search } = useLocation()
  const returnPath = pathname + search

  // Allow /callback to mount so react-oidc-context can exchange the auth code
  if (pathname === '/callback') {
    return <>{children}</>
  }

  if (auth.isLoading) {
    return (
      <div style={centerStyle} data-testid="auth-loading">
        Signing in…
      </div>
    )
  }

  if (auth.error) {
    return (
      <div style={{ ...centerStyle, flexDirection: 'column', gap: 12 }}>
        <p data-testid="auth-error">{auth.error.message}</p>
        <button data-testid="sign-in-btn" onClick={() => signIn(auth, returnPath)}>
          Try again
        </button>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={centerStyle}>
        <button data-testid="sign-in-btn" onClick={() => signIn(auth, returnPath)}>
          Sign in to continue
        </button>
      </div>
    )
  }

  return <>{children}</>
}

function signIn(auth: ReturnType<typeof useAuth>, returnPath: string) {
  saveAuthReturnPath(returnPath)
  auth.signinRedirect({ state: returnPath })
}
