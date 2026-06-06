import { type Page, expect } from '@playwright/test'

/** Wait for the SpacetimeDB connection to go active. */
export async function waitForConnection(page: Page, timeout = 10_000) {
  await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected', { timeout })
}

/** Open two independent browser pages on the same room URL. */
export async function openRoom(
  browser: import('@playwright/test').Browser,
  opts: { room?: number; role1?: string; role2?: string; policy?: string } = {}
) {
  const { room = 1, role1 = 'candidate', role2 = 'observer', policy = 'open' } = opts

  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const page1 = await ctx1.newPage()
  const page2 = await ctx2.newPage()

  const q1 = new URLSearchParams({ room: String(room), role: role1, name: role1, policy })
  const q2 = new URLSearchParams({ room: String(room), role: role2, name: role2, policy })

  await page1.goto(`/?${q1}`)
  await page2.goto(`/?${q2}`)

  return { page1, page2, ctx1, ctx2 }
}
