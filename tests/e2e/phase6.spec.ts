/**
 * Phase 6: JS Web Worker run output synced via run_output table.
 *
 * RED → fail before RunPanel, worker, and run_output table exist.
 * GREEN → pass after Phase 6 implementation.
 */
import { test, expect } from '@playwright/test'
import { waitForConnection, openRoom } from './helpers'

test.describe('Phase 6 – run output', () => {
  test('candidate clicks Run and output appears in their tab', async ({ browser }) => {
    const room = 700_000 + Math.floor(Math.random() * 99_999)
    const { page1, ctx1 } = await openRoom(browser, { room, role1: 'candidate' })
    try {
      await waitForConnection(page1)
      await expect(page1.locator('[data-testid="run-button"]')).toBeVisible({ timeout: 5_000 })
      await page1.locator('[data-testid="editor"]').fill('console.log("hello world")')
      await page1.locator('[data-testid="run-button"]').click()
      await expect(page1.locator('[data-testid="run-panel"]')).toContainText('hello world', { timeout: 10_000 })
    } finally {
      await ctx1.close()
    }
  })

  test('run output syncs live to observer tab', async ({ browser }) => {
    const room = 700_000 + Math.floor(Math.random() * 99_999)
    const { page1, page2, ctx1, ctx2 } = await openRoom(browser, {
      room,
      role1: 'candidate',
      role2: 'observer',
    })
    try {
      await waitForConnection(page1)
      await waitForConnection(page2)

      await page1.locator('[data-testid="editor"]').fill('console.log("sync test")')
      await page1.locator('[data-testid="run-button"]').click()

      await expect(page1.locator('[data-testid="run-panel"]')).toContainText('sync test', { timeout: 10_000 })
      await expect(page2.locator('[data-testid="run-panel"]')).toContainText('sync test', { timeout: 12_000 })
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })

  test('stderr errors appear in run panel', async ({ browser }) => {
    const room = 700_000 + Math.floor(Math.random() * 99_999)
    const { page1, ctx1 } = await openRoom(browser, { room, role1: 'candidate' })
    try {
      await waitForConnection(page1)
      await page1.locator('[data-testid="editor"]').fill('throw new Error("boom")')
      await page1.locator('[data-testid="run-button"]').click()
      await expect(page1.locator('[data-testid="run-panel"]')).toContainText('boom', { timeout: 10_000 })
    } finally {
      await ctx1.close()
    }
  })

  test('run button is not visible to observer', async ({ browser }) => {
    const room = 700_000 + Math.floor(Math.random() * 99_999)
    const { page2, ctx2 } = await openRoom(browser, { room, role2: 'observer' })
    try {
      await waitForConnection(page2)
      await expect(page2.locator('[data-testid="run-button"]')).not.toBeVisible({ timeout: 5_000 })
    } finally {
      await ctx2.close()
    }
  })
})
