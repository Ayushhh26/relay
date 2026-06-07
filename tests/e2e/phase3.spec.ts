/**
 * Phase 3: participant table + URL join + presence bar.
 *
 * RED → these tests fail before the participant table and presence bar exist.
 * GREEN → pass after Phase 3 implementation.
 */
import { test, expect } from '@playwright/test'
import { waitForConnection, openRoom } from './helpers'

test.describe('Phase 3 – presence', () => {
  test('joining as candidate shows a presence dot with your name', async ({ browser }) => {
    const { page1, ctx1 } = await openRoom(browser, { role1: 'candidate' })
    try {
      await waitForConnection(page1)
      await expect(page1.locator('[data-testid="presence-bar"]')).toBeVisible({ timeout: 5_000 })
      await expect(page1.locator('[data-testid="presence-bar"]')).toContainText('candidate', { timeout: 5_000 })
    } finally {
      await ctx1.close()
    }
  })

  test('two participants in the same room see each other in the presence bar', async ({ browser }) => {
    const { page1, page2, ctx1, ctx2 } = await openRoom(browser, {
      role1: 'candidate',
      role2: 'observer',
    })
    try {
      await waitForConnection(page1)
      await waitForConnection(page2)

      // Both tabs show both names (role is used as default name in openRoom helper)
      await expect(page1.locator('[data-testid="presence-bar"]')).toContainText('candidate', { timeout: 5_000 })
      await expect(page1.locator('[data-testid="presence-bar"]')).toContainText('observer', { timeout: 5_000 })
      await expect(page2.locator('[data-testid="presence-bar"]')).toContainText('candidate', { timeout: 5_000 })
      await expect(page2.locator('[data-testid="presence-bar"]')).toContainText('observer', { timeout: 5_000 })
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })

  test('closing a tab removes that participant from the presence bar', async ({ browser }) => {
    // Use a unique room per run to avoid stale participants from previous test runs
    const room = 900_000 + Math.floor(Math.random() * 99_999)
    const { page1, page2, ctx1, ctx2 } = await openRoom(browser, {
      room,
      role1: 'candidate',
      role2: 'observer',
    })
    try {
      await waitForConnection(page1)
      await waitForConnection(page2)

      // Both visible first
      await expect(page1.locator('[data-testid="presence-bar"]')).toContainText('observer', { timeout: 5_000 })

      // Close the observer tab — triggers clientDisconnected lifecycle on server
      await ctx2.close()

      // observer dot must disappear from page1 (driven by clientDisconnected)
      await expect(page1.locator('[data-testid="presence-bar"]')).not.toContainText('observer', { timeout: 15_000 })
    } finally {
      await ctx1.close()
    }
  })
})
