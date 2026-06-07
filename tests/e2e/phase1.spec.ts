/**
 * Phase 1: SpacetimeDB connection + room table syncing.
 *
 * RED → these tests fail before the room table and App.tsx are implemented.
 * GREEN → pass after Phase 1 implementation.
 */
import { test, expect } from '@playwright/test'
import { waitForConnection } from './helpers'

test.describe('Phase 1 – room sync', () => {
  test('shows Connected status after SpacetimeDB handshake', async ({ page }) => {
    await page.goto('/')
    // Must have a [data-testid="connection-status"] element that reads "Connected"
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected', { timeout: 10_000 })
  })

  test('both tabs subscribe and show the editor after connecting', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    try {
      await page1.goto('/?role=candidate')
      await page2.goto('/?role=observer')

      await waitForConnection(page1)
      await waitForConnection(page2)

      // Both tabs must render the editor — proves room auto-creation and
      // document subscription are active in every connected window
      await expect(page1.locator('[data-testid="editor"]')).toBeVisible({ timeout: 5_000 })
      await expect(page2.locator('[data-testid="editor"]')).toBeVisible({ timeout: 5_000 })
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })
})
