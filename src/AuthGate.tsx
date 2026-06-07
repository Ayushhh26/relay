import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { saveAuthReturnPath } from './authReturnPath'
import {
  AuthBrand,
  AuthCard,
  AuthErrorMessage,
  AuthFeaturePills,
  AuthLayout,
  AuthPrimaryButton,
  AuthSecondaryButton,
  AuthSpinner,
  RelayLogo,
} from './authUi'

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
  const { pathname, search } = useLocation()
  const returnPath = pathname + search

  if (pathname === '/callback' || pathname === '/logout') {
    return <>{children}</>
  }

  if (auth.isLoading) {
    return (
      <AuthLayout testId="auth-gate">
        <AuthCard>
          <AuthBrand subtitle="Collaborative rooms" />
          <AuthSpinner label="Checking your session…" />
        </AuthCard>
      </AuthLayout>
    )
  }

  if (auth.error) {
    return (
      <AuthLayout testId="auth-gate">
        <AuthCard>
          <AuthBrand subtitle="Sign in" />
          <AuthErrorMessage message={auth.error.message} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <AuthPrimaryButton testId="sign-in-btn" onClick={() => signIn(auth, returnPath)}>
              Try again
            </AuthPrimaryButton>
            <AuthSecondaryButton onClick={() => window.location.assign('/')}>
              Back to home
            </AuthSecondaryButton>
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <AuthLayout testId="auth-gate">
        <div className="auth-hero">
          <RelayLogo size={56} />
          <h1 className="auth-hero__title">Relay</h1>
          <p className="auth-hero__tagline">Code together. The AI knows its place.</p>
        </div>
        <AuthCard>
          <p className="auth-copy" style={{ textAlign: 'center', marginBottom: 20 }}>
            Sign in to create interview rooms, run code live, and collaborate in real time.
          </p>
          <AuthPrimaryButton testId="sign-in-btn" onClick={() => signIn(auth, returnPath)}>
            Sign in with SpacetimeDB
          </AuthPrimaryButton>
          <AuthFeaturePills />
        </AuthCard>
      </AuthLayout>
    )
  }

  return <>{children}</>
}

function signIn(auth: ReturnType<typeof useAuth>, returnPath: string) {
  saveAuthReturnPath(returnPath)
  auth.signinRedirect({ state: returnPath })
}
