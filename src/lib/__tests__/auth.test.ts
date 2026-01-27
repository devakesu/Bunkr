import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setToken, getToken, removeToken } from '../auth'

// Mock cookies-next
vi.mock('cookies-next', () => ({
  setCookie: vi.fn(),
  getCookie: vi.fn(),
  deleteCookie: vi.fn(),
}))

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// Note: Supabase client mock is provided globally in vitest.setup.ts

import { setCookie, getCookie, deleteCookie } from 'cookies-next'

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any stubbed environment variables
    vi.unstubAllEnvs()
  })

  describe('setToken', () => {
    it('should set cookie with default expiration of 31 days', () => {
      const token = 'test-token-123'
      const now = Date.now()
      
      setToken(token)

      expect(setCookie).toHaveBeenCalledWith(
        'ezygo_access_token',
        token,
        expect.objectContaining({
          secure: false, // NODE_ENV !== 'production' in tests
          sameSite: 'lax',
          path: '/',
        })
      )

      const call = (setCookie as any).mock.calls[0]
      const expires = call[2].expires
      const expectedExpires = new Date(now + 31 * 24 * 60 * 60 * 1000)
      
      // Allow 1 second tolerance for test execution time
      expect(Math.abs(expires.getTime() - expectedExpires.getTime())).toBeLessThan(1000)
    })

    it('should set cookie with custom expiration', () => {
      const token = 'test-token-456'
      const expiresInDays = 7
      const now = Date.now()
      
      setToken(token, expiresInDays)

      const call = (setCookie as any).mock.calls[0]
      const expires = call[2].expires
      const expectedExpires = new Date(now + expiresInDays * 24 * 60 * 60 * 1000)
      
      expect(Math.abs(expires.getTime() - expectedExpires.getTime())).toBeLessThan(1000)
    })

    it('should set secure cookie in production', () => {
      vi.stubEnv('NODE_ENV', 'production')
      
      setToken('token')

      expect(setCookie).toHaveBeenCalledWith(
        'ezygo_access_token',
        'token',
        expect.objectContaining({
          secure: true,
        })
      )
    })
  })

  describe('getToken', () => {
    it('should return token from cookie', () => {
      const mockToken = 'stored-token-789'
      vi.mocked(getCookie).mockReturnValue(mockToken)

      const result = getToken()

      expect(getCookie).toHaveBeenCalledWith('ezygo_access_token')
      expect(result).toBe(mockToken)
    })

    it('should return undefined when no token exists', () => {
      vi.mocked(getCookie).mockReturnValue(undefined)

      const result = getToken()

      expect(result).toBeUndefined()
    })
  })

  describe('removeToken', () => {
    it('should delete the token cookie', () => {
      removeToken()

      expect(deleteCookie).toHaveBeenCalledWith('ezygo_access_token', { path: '/' })
    })
  })
})
