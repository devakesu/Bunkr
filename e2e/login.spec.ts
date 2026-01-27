import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/')
    
    // Check that the page loads with a form or login interface
    const hasForm = await page.locator('form').count() > 0
    const hasInput = await page.locator('input').count() > 0
    
    expect(hasForm || hasInput).toBeTruthy()
  })

  test('should have input fields', async ({ page }) => {
    await page.goto('/')
    
    // Check for any input fields (username, email, or password)
    const inputCount = await page.locator('input[type="text"], input[type="password"], input[type="email"]').count()
    expect(inputCount).toBeGreaterThan(0)
  })

  test('should load without errors', async ({ page }) => {
    await page.goto('/')
    
    // Verify no error pages
    await expect(page).not.toHaveURL(/error/)
    await expect(page).not.toHaveURL(/404/)
    
    // Verify the page title exists
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })
})
