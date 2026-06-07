/**
 * Phase 7: Study session — kind='study' rooms where all participants edit/run/ask together.
 *
 * RED  → fail before Lobby kind selector, study permissions, and refresh-rejoin exist.
 * GREEN → pass after Stage 3 implementation.
 *
 * The /api/assist call is mocked via Playwright route interception so CI does not
 * need a live Vercel deployment or API key.
 */
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { waitForConnection } from './helpers'

const MOCK_STUDY_ASSIST = {
  response: 'mock study answer',
  requestedType: 'syntax',
  assistType: 'syntax',
  policyStatus: 'allowed',
}

// ---------------------------------------------------------------------------
// Local helper: creates a study room from Lobby and returns the host page +
// roomId. Caller is responsible for closing ctx.
// ---------------------------------------------------------------------------
async function createStudyRoomAsHost(
  browser: Browser
): Promise<{ page: Page; ctx: BrowserContext; roomId: bigint }> {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  await page.goto('/')
  await waitForConnection(page)

  const title = `study-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
  await page.locator('[data-testid="room-title-input"]').fill(title)
  await page.locator('[data-testid="room-kind-select"]').selectOption('study')
  await page.locator('[data-testid="create-room-btn"]').click()

  await expect(page.locator('[data-testid="room-id"]')).toBeVisible({ timeout: 8_000 })
  const roomIdText = await page.locator('[data-testid="room-id"]').textContent()
  const roomId = BigInt(roomIdText!.trim())

  // Enter as host (not interviewer)
  await page.locator('[data-testid="enter-as-host-btn"]').click()
  await page.waitForURL('**/room/**', { timeout: 15_000 })

  return { page, ctx, roomId }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Phase 7 – study session', () => {
  test('lobby shows host/member invite links and enter-as-host button for study rooms', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    try {
      await page.goto('/')
      await waitForConnection(page)

      await page.locator('[data-testid="room-title-input"]').fill('study lobby test')
      await page.locator('[data-testid="room-kind-select"]').selectOption('study')
      await page.locator('[data-testid="create-room-btn"]').click()

      // Host entry button should say "host", not "interviewer"
      await expect(page.locator('[data-testid="enter-as-host-btn"]')).toBeVisible({ timeout: 8_000 })
      await expect(page.locator('[data-testid="enter-as-interviewer-btn"]')).not.toBeVisible()

      // Invite links: host + member visible; candidate/observer hidden
      await expect(page.locator('[data-testid="host-link"]')).toBeVisible()
      await expect(page.locator('[data-testid="member-link"]')).toBeVisible()
      await expect(page.locator('[data-testid="candidate-link"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="observer-link"]')).not.toBeVisible()
    } finally {
      await ctx.close()
    }
  })

  test('host enters study room — editor is blank, no QuestionPanel', async ({ browser }) => {
    const { page, ctx } = await createStudyRoomAsHost(browser)
    try {
      await waitForConnection(page)

      // Editor present
      await expect(page.locator('[data-testid="editor"]')).toBeVisible({ timeout: 5_000 })

      // No question/problem panel (interview-only)
      await expect(page.locator('[data-testid="question-panel"]')).not.toBeVisible()

      // Run button visible for host (canRun = canEditDoc = true in study)
      await expect(page.locator('[data-testid="run-button"]')).toBeVisible({ timeout: 5_000 })
    } finally {
      await ctx.close()
    }
  })

  test('host edits and member sees live update', async ({ browser }) => {
    const { page: hostPage, ctx: hostCtx, roomId } = await createStudyRoomAsHost(browser)
    const memberCtx = await browser.newContext()
    const memberPage = await memberCtx.newPage()
    try {
      await memberPage.goto(`/join/${roomId}?role=member&name=Bob`)
      await memberPage.waitForURL('**/room/**', { timeout: 15_000 })

      await waitForConnection(hostPage)
      await waitForConnection(memberPage)

      // Both should see Run button (member can also edit/run in study rooms)
      await expect(memberPage.locator('[data-testid="run-button"]')).toBeVisible({ timeout: 5_000 })

      // Host types in editor
      await hostPage.locator('[data-testid="editor"]').fill('function hello() { return 42; }')

      // Member sees the same content
      await expect(memberPage.locator('[data-testid="editor"]')).toHaveValue(
        'function hello() { return 42; }',
        { timeout: 10_000 }
      )
    } finally {
      await hostCtx.close()
      await memberCtx.close()
    }
  })

  test('member clicks Run and output syncs to both tabs', async ({ browser }) => {
    const { page: hostPage, ctx: hostCtx, roomId } = await createStudyRoomAsHost(browser)
    const memberCtx = await browser.newContext()
    const memberPage = await memberCtx.newPage()
    try {
      await memberPage.goto(`/join/${roomId}?role=member&name=Bob`)
      await memberPage.waitForURL('**/room/**', { timeout: 15_000 })

      await waitForConnection(hostPage)
      await waitForConnection(memberPage)

      // Host fills the editor with runnable code
      await hostPage.locator('[data-testid="editor"]').fill('console.log("hello study")')

      // Wait for the content to sync to member's editor before running
      await expect(memberPage.locator('[data-testid="editor"]')).toHaveValue(
        'console.log("hello study")',
        { timeout: 10_000 }
      )

      // Member clicks Run (study: any participant can run)
      await expect(memberPage.locator('[data-testid="run-button"]')).toBeVisible({ timeout: 5_000 })
      await memberPage.locator('[data-testid="run-button"]').click()

      // Both tabs see the output
      await expect(memberPage.locator('[data-testid="run-panel"]')).toContainText('hello study', { timeout: 10_000 })
      await expect(hostPage.locator('[data-testid="run-panel"]')).toContainText('hello study', { timeout: 12_000 })
    } finally {
      await hostCtx.close()
      await memberCtx.close()
    }
  })

  test('member asks Assist and both tabs see the answer in assist log', async ({ browser }) => {
    const { page: hostPage, ctx: hostCtx, roomId } = await createStudyRoomAsHost(browser)
    const memberCtx = await browser.newContext()
    const memberPage = await memberCtx.newPage()
    try {
      await memberPage.goto(`/join/${roomId}?role=member&name=Bob`)
      await memberPage.waitForURL('**/room/**', { timeout: 15_000 })

      await waitForConnection(hostPage)
      await waitForConnection(memberPage)

      // Mock /api/assist on both pages so CI needs no live API key
      const mockFulfill = async (route: import('@playwright/test').Route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(MOCK_STUDY_ASSIST),
        })
      }
      await hostPage.route('**/api/assist', mockFulfill)
      await memberPage.route('**/api/assist', mockFulfill)

      // Member (not just candidate) can ask assist in study rooms
      await expect(memberPage.locator('[data-testid="assist-input"]')).toBeVisible({ timeout: 5_000 })
      await memberPage.locator('[data-testid="assist-input"]').fill('how does this work')
      await memberPage.locator('[data-testid="assist-submit"]').click()

      // Both tabs see the response
      await expect(memberPage.locator('[data-testid="assist-log"]')).toContainText('mock study answer', { timeout: 8_000 })
      await expect(hostPage.locator('[data-testid="assist-log"]')).toContainText('mock study answer', { timeout: 10_000 })
    } finally {
      await hostCtx.close()
      await memberCtx.close()
    }
  })
})
