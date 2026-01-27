import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/')
    
    // Check that the page loads successfully
    await expect(page).toHaveTitle(/GhostClass/i)
    
    // Check that there's a login-related element (could be button, link, or form)
    const hasLoginButton = await page.getByRole('button', { name: /login/i }).count() > 0
    const hasLoginLink = await page.getByRole('link', { name: /login/i }).count() > 0
    const hasLoginForm = await page.locator('form').count() > 0
    
    expect(hasLoginButton || hasLoginLink || hasLoginForm).toBeTruthy()
  })

  test('should render main content', async ({ page }) => {
    await page.goto('/')
    
    // Check that the main content area exists
    await expect(page.locator('body')).toBeVisible()
    
    // Verify the page is interactive
    await expect(page).not.toHaveURL(/error/)
  })
})
