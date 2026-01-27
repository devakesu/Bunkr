import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/')
    
    // Check logo is visible
    await expect(page.getByAlt('GhostClass Logo')).toBeVisible()
    
    // Check login button exists
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible()
  })

  test('should navigate to contact page', async ({ page }) => {
    await page.goto('/')
    
    await page.getByRole('button', { name: /contact/i }).click()
    
    await expect(page).toHaveURL('/contact')
    await expect(page.getByRole('heading', { name: /contact/i })).toBeVisible()
  })

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/')
    
    // Check ARIA labels
    const nav = page.getByRole('navigation')
    await expect(nav).toBeVisible()
  })
})
