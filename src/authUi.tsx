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

export function RelayLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="13" fill="url(#relay-grad)"/>
      <defs>
        <linearGradient id="relay-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#1d4ed8"/>
        </linearGradient>
      </defs>
      {/* Left endpoint */}
      <circle cx="9" cy="24" r="3.5" fill="white" fillOpacity={0.5}/>
      {/* Left connector */}
      <rect x="13" y="23" width="8.5" height="2" rx="1" fill="white" fillOpacity={0.35}/>
      {/* Center relay node */}
      <circle cx="24" cy="24" r="6" fill="white"/>
      {/* Outer ring — relay wave */}
      <circle cx="24" cy="24" r="10" stroke="white" strokeWidth="0.8" strokeOpacity={0.15}/>
      {/* Right connector */}
      <rect x="26.5" y="23" width="8.5" height="2" rx="1" fill="white" fillOpacity={0.35}/>
      {/* Right endpoint */}
      <circle cx="39" cy="24" r="3.5" fill="white" fillOpacity={0.5}/>
    </svg>
  )
}

export function AuthBrand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="auth-brand">
      <div className="auth-brand__mark">
        <RelayLogo size={36} />
      </div>
      <div>
        <h1 className="auth-brand__title">Relay</h1>
        {subtitle && <p className="auth-brand__subtitle">{subtitle}</p>}
      </div>
    </div>
  )
}

export function AuthFeaturePills() {
  const features = [
    { label: 'AI Guardrails', color: '#60a5fa' },
    { label: 'Live Code Execution', color: '#4ade80' },
    { label: 'Real-time Sync', color: '#a78bfa' },
  ]
  return (
    <div className="auth-features">
      {features.map(f => (
        <span key={f.label} className="auth-feature-pill">
          <span className="auth-feature-pill__dot" style={{ background: f.color }}/>
          {f.label}
        </span>
      ))}
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
