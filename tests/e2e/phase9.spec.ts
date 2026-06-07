/**
 * Phase 9: Lobby + invite links + server-enforced room roles (Stage 0).
 *
 * RED → fail before routing, lobby, and reducer guards exist.
 * GREEN → pass after Stage 0 is complete.
 */
import { test, expect } from '@playwright/test'
import { waitForConnection, createRoomFromLobby } from './helpers'

test.describe('Phase 9 – lobby + server-enforced roles', () => {
  test('host creates room from lobby and sees 3 invite links', async ({ page }) => {
    await page.goto('/')
    await waitForConnection(page)
    const title = `demo-${Date.now()}`
    await page.locator('[data-testid="room-title-input"]').fill(title)
    await page.locator('[data-testid="create-room-btn"]').click()

    await expect(page.locator('[data-testid="room-id"]')).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('[data-testid="candidate-link"]')).toBeVisible()
    await expect(page.locator('[data-testid="observer-link"]')).toBeVisible()
    await expect(page.locator('[data-testid="interviewer-link"]')).toBeVisible()
  })

  test('candidate can edit, observer is read-only (server-enforced)', async ({ browser }) => {
    const roomId = await createRoomFromLobby(browser)

    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const candidate = await ctx1.newPage()
    const observer = await ctx2.newPage()

    try {
      await candidate.goto(`/join/${roomId}?role=candidate&name=Alice`)
      await observer.goto(`/join/${roomId}?role=observer&name=Charlie`)

      await candidate.waitForURL(`**/room/**`, { timeout: 15_000 })
      await observer.waitForURL(`**/room/**`, { timeout: 15_000 })

      await waitForConnection(candidate)
      await waitForConnection(observer)

      const isReadOnly = await candidate.locator('[data-testid="editor"]').getAttribute('readonly')
      expect(isReadOnly).toBeNull()

      await expect(observer.locator('[data-testid="editor"]')).toHaveAttribute('readonly', '')
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })

  test('second candidate is rejected with seat taken message', async ({ browser }) => {
    const roomId = await createRoomFromLobby(browser)

    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const candidate1 = await ctx1.newPage()
    const candidate2 = await ctx2.newPage()

    try {
      await candidate1.goto(`/join/${roomId}?role=candidate&name=Alice`)
      await candidate1.waitForURL(`**/room/**`, { timeout: 15_000 })
      await waitForConnection(candidate1)
      await expect(candidate1.locator('[data-testid="editor"]')).toBeVisible({ timeout: 5_000 })

      await candidate2.goto(`/join/${roomId}?role=candidate&name=Bob`)
      await expect(candidate2.locator('[data-testid="join-error"]')).toContainText(
        'Candidate seat',
        { timeout: 12_000 }
      )
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })

  test('room policy is read from room table, not URL param', async ({ browser }) => {
    const roomId = await createRoomFromLobby(browser, { policy: 'nudge-only' })

    const ctx1 = await browser.newContext()
    const candidate = await ctx1.newPage()
    let capturedPolicy: string | null = null

    try {
      await candidate.goto(`/join/${roomId}?role=candidate&name=Alice`)
      await candidate.waitForURL(`**/room/**`, { timeout: 15_000 })
      await waitForConnection(candidate)

      await candidate.route('**/api/assist', async route => {
        const body = JSON.parse(route.request().postData() ?? '{}')
        capturedPolicy = body.policy
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            response: 'think about it',
            requestedType: 'solution-leaning',
            assistType: 'nudge',
            policyStatus: 'downgraded',
          }),
        })
      })

      await expect(candidate.locator('[data-testid="assist-input"]')).toBeVisible({ timeout: 5_000 })
      await candidate.locator('[data-testid="assist-input"]').fill('write the complete solution')
      await candidate.locator('[data-testid="assist-submit"]').click()

      await expect(candidate.locator('[data-testid="assist-log"]')).toContainText(
        'policy enforced',
        { timeout: 8_000 }
      )
      expect(capturedPolicy).toBe('nudge-only')
    } finally {
      await ctx1.close()
    }
  })
})
