/**
 * Phase 2: document table + debounced editor sync.
 *
 * RED → these tests fail before Editor.tsx and document table exist.
 * GREEN → pass after Phase 2 implementation.
 */
import { test, expect } from '@playwright/test'
import { waitForConnection, openRoom } from './helpers'

test.describe('Phase 2 – editor sync', () => {
  test('candidate editor is writable', async ({ browser }) => {
    const { page1, ctx1 } = await openRoom(browser, { role1: 'candidate' })
    try {
      await waitForConnection(page1)
      const editor = page1.locator('[data-testid="editor"]')
      await expect(editor).toBeVisible({ timeout: 5_000 })
      const isReadOnly = await editor.getAttribute('readonly')
      expect(isReadOnly).toBeNull()
    } finally {
      await ctx1.close()
    }
  })

  test('observer editor is read-only', async ({ browser }) => {
    const { page2, ctx2 } = await openRoom(browser, { role2: 'observer' })
    try {
      await waitForConnection(page2)
      const editor = page2.locator('[data-testid="editor"]')
      await expect(editor).toBeVisible({ timeout: 5_000 })
      const isReadOnly = await editor.getAttribute('readonly')
      expect(isReadOnly).not.toBeNull()
    } finally {
      await ctx2.close()
    }
  })

  test('text typed by candidate appears in observer tab without refresh', async ({ browser }) => {
    const { page1, page2, ctx1, ctx2 } = await openRoom(browser, {
      role1: 'candidate',
      role2: 'observer',
    })
    try {
      await waitForConnection(page1)
      await waitForConnection(page2)

      await page1.locator('[data-testid="editor"]').fill('function hello() {}')

      // Allow for debounce (300ms) + network round-trip + re-render
      await expect(page2.locator('[data-testid="editor"]')).toHaveValue(
        'function hello() {}',
        { timeout: 8_000 }
      )
    } finally {
      await ctx1.close()
      await ctx2.close()
    }
  })
})
