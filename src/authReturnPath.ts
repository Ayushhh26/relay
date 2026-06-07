const AUTH_RETURN_PATH_KEY = 'relay/auth-return-path'

/** Remember where the user was before OIDC sign-in (tab-local fallback). */
export function saveAuthReturnPath(path: string) {
  sessionStorage.setItem(AUTH_RETURN_PATH_KEY, path)
}

/** Return saved path and clear it. Defaults to lobby. */
export function consumeAuthReturnPath(): string {
  const path = sessionStorage.getItem(AUTH_RETURN_PATH_KEY) ?? '/'
  sessionStorage.removeItem(AUTH_RETURN_PATH_KEY)
  return path
}

/** Only allow in-app relative paths. */
export function sanitizeReturnPath(path: unknown): string {
  if (typeof path !== 'string') return '/'
  if (!path.startsWith('/') || path.startsWith('//')) return '/'
  return path
}

/** Prefer OIDC round-tripped state; fall back to sessionStorage. */
export function resolveAuthReturnPath(oidcState: unknown): string {
  const fromOidc = sanitizeReturnPath(oidcState)
  if (fromOidc !== '/') return fromOidc
  return sanitizeReturnPath(consumeAuthReturnPath())
}
