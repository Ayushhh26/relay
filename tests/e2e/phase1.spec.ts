/**
 * Phase 1: SpacetimeDB connection + room table syncing.
 *
 * RED → these tests fail before the room table and App.tsx are implemented.
 * GREEN → pass after Phase 1 implementation.
 */
import { test, expect } from '@playwright/test'
import { waitForConnection, openRoom } from './helpers'

test.describe('Phase 1 – room sync', () => {
  test('shows Connected status after SpacetimeDB handshake', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected', { timeout: 10_000 })
  })

  test('both tabs subscribe and show the editor after connecting', async ({ browser }) => {
    const { page1, page2, ctx1, ctx2 } = await openRoom(browser, {
      role1: 'candidate',
      role2: 'observer',
    })
    try {
      await waitForConnection(page1)
      await waitForConnection(page2)

      await expect(page1.locator('[data-testid="editor"]')).toBeVisible({ timeout: 5_000 })
      await expect(page2.locator('[data-testid="editor"]')).toBeVisible({ timeout: 5_000 })
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })
})
