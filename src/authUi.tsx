import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { profileDisplayName } from './profileDisplayName'

export const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true'

interface AuthLayoutProps {
  children: ReactNode
  testId?: string
}

export function AuthLayout({ children, testId }: AuthLayoutProps) {
  return (
    <div className="auth-page" data-testid={testId}>
      <div className="auth-page__glow" aria-hidden />
      <div className="auth-page__inner">{children}</div>
    </div>
  )
}

export function AuthCard({ children }: { children: ReactNode }) {
  return <div className="auth-card">{children}</div>
}

export function AuthBrand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="auth-brand">
      <div className="auth-brand__mark">R</div>
      <div>
        <h1 className="auth-brand__title">Relay</h1>
        {subtitle && <p className="auth-brand__subtitle">{subtitle}</p>}
      </div>
    </div>
  )
}

export function AuthSpinner({ label }: { label: string }) {
  return (
    <div className="auth-status">
      <span className="auth-spinner" aria-hidden />
      <span data-testid="auth-loading">{label}</span>
    </div>
  )
}

export function AuthErrorMessage({ message }: { message: string }) {
  return (
    <div className="auth-error" data-testid="auth-error" role="alert">
      {message}
    </div>
  )
}

interface AuthButtonProps {
  children: ReactNode
  onClick?: () => void
  testId?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}

export function AuthPrimaryButton({ children, onClick, testId, disabled, type = 'button' }: AuthButtonProps) {
  return (
    <button
      type={type}
      className="auth-btn auth-btn--primary"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function AuthSecondaryButton({ children, onClick, testId, disabled }: AuthButtonProps) {
  return (
    <button
      type="button"
      className="auth-btn auth-btn--secondary"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function AuthFooterNote({ children }: { children: ReactNode }) {
  return <p className="auth-footnote">{children}</p>
}

export function AuthUserChip({ compact = false }: { compact?: boolean }) {
  const auth = useAuth()

  if (!AUTH_ENABLED || !auth.isAuthenticated) return null

  const name = profileDisplayName(auth)

  return (
    <div className={compact ? 'auth-user auth-user--compact' : 'auth-user'}>
      <span className="auth-user__avatar" aria-hidden>
        {initials(name)}
      </span>
      {!compact && <span className="auth-user__name">{name}</span>}
      <Link to="/logout" className="auth-user__sign-out" data-testid="sign-out-link" title="Sign out">
        Sign out
      </Link>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
}

export const authInlineStyles: Record<string, CSSProperties> = {
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
}
