import type { ReactNode } from 'react'
import { useAuth } from 'react-oidc-context'

interface Props {
  children: ReactNode
}

export function AuthGate({ children }: Props) {
  if (import.meta.env.VITE_AUTH_ENABLED !== 'true') {
    return <>{children}</>
  }
  return <AuthGateOIDC>{children}</AuthGateOIDC>
}

function AuthGateOIDC({ children }: Props) {
  const auth = useAuth()

  if (auth.isLoading) {
    return <div data-testid="auth-loading">Signing in…</div>
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <button data-testid="sign-in-btn" onClick={() => auth.signinRedirect()}>
          Sign in to continue
        </button>
      </div>
    )
  }

  return <>{children}</>
}
