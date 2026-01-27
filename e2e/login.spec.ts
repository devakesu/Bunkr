import { test, expect } from '@playwright/test'

test.describe('Application', () => {
  test('should respond to requests', async ({ page }) => {
    const response = await page.goto('/')
    
    // Check that the server responds successfully
    expect(response?.status()).toBeLessThan(400)
  })

  test('should render HTML content', async ({ page }) => {
    await page.goto('/')
    
    // Verify the page has HTML content
    const bodyContent = await page.locator('body').textContent()
    expect(bodyContent).toBeTruthy()
  })

  test('should have a non-empty page title', async ({ page }) => {
    await page.goto('/')
    
    // Verify the page has a title
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })
})
