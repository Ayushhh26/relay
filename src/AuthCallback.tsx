import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { resolveAuthReturnPath } from './authReturnPath'
import {
  AuthBrand,
  AuthCard,
  AuthErrorMessage,
  AuthLayout,
  AuthPrimaryButton,
  AuthSecondaryButton,
  AuthSpinner,
} from './authUi'

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
      <AuthLayout testId="auth-callback">
        <AuthCard>
          <AuthBrand subtitle="Sign in" />
          <AuthErrorMessage message={`Sign-in failed: ${auth.error.message}`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <AuthPrimaryButton testId="sign-in-btn" onClick={() => auth.signinRedirect()}>
              Try again
            </AuthPrimaryButton>
            <AuthSecondaryButton onClick={() => navigate('/', { replace: true })}>
              Back to home
            </AuthSecondaryButton>
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout testId="auth-callback">
      <AuthCard>
        <AuthBrand subtitle="Almost there" />
        <AuthSpinner label="Completing sign-in…" />
      </AuthCard>
    </AuthLayout>
  )
}
