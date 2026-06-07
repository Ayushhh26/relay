import { type Browser, type Page, expect } from '@playwright/test'

/** Wait for the SpacetimeDB connection to go active. */
export async function waitForConnection(page: Page, timeout = 10_000) {
  await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected', { timeout })
}

/** Create a room via the Lobby UI and return its BigInt ID. */
export async function createRoomFromLobby(
  browser: Browser,
  opts: { policy?: string } = {}
): Promise<bigint> {
  const { policy = 'open' } = opts
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await page.goto('/')
    await waitForConnection(page)
    const title = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    await page.locator('[data-testid="room-title-input"]').fill(title)
    if (policy !== 'open') {
      await page.locator('[data-testid="policy-select"]').selectOption(policy)
    }
    await page.locator('[data-testid="create-room-btn"]').click()
    await expect(page.locator('[data-testid="room-id"]')).toBeVisible({ timeout: 8_000 })
    const text = await page.locator('[data-testid="room-id"]').textContent()
    return BigInt(text!.trim())
  } finally {
    await ctx.close()
  }
}

/**
 * Open two independent browser pages in the same room and wait for both
 * to reach the RoomView after auto-joining via the join URL.
 */
export async function openRoom(
  browser: Browser,
  opts: { room?: number; role1?: string; role2?: string; policy?: string } = {}
) {
  const { role1 = 'candidate', role2 = 'observer', policy = 'open' } = opts

  const roomId = await createRoomFromLobby(browser, { policy })

  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const page1 = await ctx1.newPage()
  const page2 = await ctx2.newPage()

  await page1.goto(`/join/${roomId}?role=${role1}&name=${role1}`)
  await page2.goto(`/join/${roomId}?role=${role2}&name=${role2}`)

  await page1.waitForURL(`**/room/**`, { timeout: 15_000 })
  await page2.waitForURL(`**/room/**`, { timeout: 15_000 })

  return { page1, page2, ctx1, ctx2 }
}
