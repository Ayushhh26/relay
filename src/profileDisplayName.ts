import type { useAuth } from 'react-oidc-context'

export function profileDisplayName(auth: ReturnType<typeof useAuth>, fallback = 'Guest'): string {
  const profile = auth.user?.profile as Record<string, string | undefined> | undefined
  return profile?.name ?? profile?.preferred_username ?? profile?.email ?? fallback
}
