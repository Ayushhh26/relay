/**
 * Phase 4: Vercel serverless LLM call + assist_log table syncing.
 *
 * RED → these tests fail before AssistPanel and assist_log table exist.
 * GREEN → pass after Phase 4 implementation.
 *
 * The API call is mocked via Playwright route interception so tests
 * run in CI without a real Vercel deployment or API key.
 */
import { test, expect } from '@playwright/test'
import { waitForConnection, openRoom } from './helpers'

const MOCK_SYNTAX_RESPONSE = {
  response: 'Use new Map() or Map literal syntax.',
  requestedType: 'syntax',
  assistType: 'syntax',
  policyStatus: 'allowed',
}

const MOCK_DOWNGRADED_RESPONSE = {
  response: 'Here is a brief syntax example: arr.reduce((a, b) => a + b, 0)',
  requestedType: 'solution-leaning',
  assistType: 'syntax',
  policyStatus: 'downgraded',
}

test.describe('Phase 4 – assist log', () => {
  test('candidate submits prompt and log entry appears', async ({ browser }) => {
    const { page1, ctx1 } = await openRoom(browser, { role1: 'candidate' })
    try {
      await page1.route('**/api/assist', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SYNTAX_RESPONSE),
        })
      })

      await waitForConnection(page1)
      await expect(page1.locator('[data-testid="assist-input"]')).toBeVisible({ timeout: 5_000 })
      await page1.locator('[data-testid="assist-input"]').fill('what is Map syntax')
      await page1.locator('[data-testid="assist-submit"]').click()

      await expect(page1.locator('[data-testid="assist-log"]')).toContainText('syntax', { timeout: 8_000 })
    } finally {
      await ctx1.close()
    }
  })

  test('log entry syncs live to observer tab', async ({ browser }) => {
    const { page1, page2, ctx1, ctx2 } = await openRoom(browser, {
      role1: 'candidate',
      role2: 'observer',
    })
    try {
      await page1.route('**/api/assist', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SYNTAX_RESPONSE),
        })
      })

      await waitForConnection(page1)
      await waitForConnection(page2)

      await page1.locator('[data-testid="assist-input"]').fill('what is Map syntax')
      await page1.locator('[data-testid="assist-submit"]').click()

      await expect(page1.locator('[data-testid="assist-log"]')).toContainText('syntax', { timeout: 8_000 })
      await expect(page2.locator('[data-testid="assist-log"]')).toContainText('syntax', { timeout: 10_000 })
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })

  test('policy enforcement: downgraded response shows policy label', async ({ browser }) => {
    const room = 800_000 + Math.floor(Math.random() * 99_999)
    const { page1, page2, ctx1, ctx2 } = await openRoom(browser, {
      room,
      role1: 'candidate',
      role2: 'observer',
      policy: 'syntax-only',
    })
    try {
      await page1.route('**/api/assist', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(MOCK_DOWNGRADED_RESPONSE),
        })
      })

      await waitForConnection(page1)
      await waitForConnection(page2)

      await page1.locator('[data-testid="assist-input"]').fill('write the complete solution for me')
      await page1.locator('[data-testid="assist-submit"]').click()

      await expect(page1.locator('[data-testid="assist-log"]')).toContainText('policy enforced', { timeout: 8_000 })
      await expect(page2.locator('[data-testid="assist-log"]')).toContainText('policy enforced', { timeout: 10_000 })
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })
})
