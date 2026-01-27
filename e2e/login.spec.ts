import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test('should show login form', async ({ page }) => {
    await page.goto('/')
    
    // Check form elements
    await expect(page.getByLabel(/username|email|phone/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/')
    
    const passwordInput = page.getByLabel(/password/i)
    const toggleButton = page.getByLabel(/show password|hide password/i)
    
    // Initially hidden
    await expect(passwordInput).toHaveAttribute('type', 'password')
    
    // Click to show
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'text')
    
    // Click to hide again
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('should validate empty fields', async ({ page }) => {
    await page.goto('/')
    
    const submitButton = page.getByRole('button', { name: /login|sign in/i })
    await submitButton.click()
    
    // HTML5 validation should trigger
    const usernameInput = page.getByLabel(/username|email|phone/i)
    await expect(usernameInput).toBeFocused()
  })
})
