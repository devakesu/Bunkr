import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// Mock Next.js headers/cookies
const mockCookies = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookies)),
}));

// Import after mocks are set up
import {
  validateCsrfToken,
  setCsrfCookie,
  getCsrfTokenFromCookie,
  initializeCsrfToken,
  clearCsrfToken,
} from '../csrf';
import { CSRF_HEADER, CSRF_TOKEN_NAME } from '../csrf-constants';

describe('CSRF Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateCsrfToken', () => {
    it('should return false when header token is missing', async () => {
      const request = new Request('http://localhost', {
        method: 'POST',
      });

      const result = await validateCsrfToken(request);
      expect(result).toBe(false);
    });

    it('should return false when cookie token is missing (no first-time bypass)', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const request = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_HEADER]: 'test-token',
        },
      });

      const result = await validateCsrfToken(request);
      expect(result).toBe(false);
    });

    it('should return true when tokens match', async () => {
      const token = 'matching-token';
      mockCookies.get.mockReturnValue({ value: token });

      const request = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_HEADER]: token,
        },
      });

      const result = await validateCsrfToken(request);
      expect(result).toBe(true);
    });

    it('should return false when tokens do not match', async () => {
      mockCookies.get.mockReturnValue({ value: 'cookie-token' });

      const request = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_HEADER]: 'different-token',
        },
      });

      const result = await validateCsrfToken(request);
      expect(result).toBe(false);
    });

    it('should return false when tokens have different lengths (timing attack prevention)', async () => {
      mockCookies.get.mockReturnValue({ value: 'short' });

      const request = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_HEADER]: 'this-is-a-much-longer-token',
        },
      });

      const result = await validateCsrfToken(request);
      expect(result).toBe(false);
    });

    it('should handle invalid tokens gracefully', async () => {
      mockCookies.get.mockImplementation(() => {
        throw new Error('Cookie error');
      });

      const request = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_HEADER]: 'test-token',
        },
      });

      const result = await validateCsrfToken(request);
      expect(result).toBe(false);
    });

    it('should use constant-time comparison to prevent timing attacks', async () => {
      const validToken = crypto.randomBytes(32).toString('hex');
      mockCookies.get.mockReturnValue({ value: validToken });

      // Create a token that differs only in the last character
      const almostValidToken = validToken.slice(0, -1) + 'x';

      const request = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_HEADER]: almostValidToken,
        },
      });

      const result = await validateCsrfToken(request);
      expect(result).toBe(false);
    });
  });

  describe('setCsrfCookie', () => {
    it('should set cookie with correct attributes', async () => {
      const token = 'test-token';
      await setCsrfCookie(token);

      expect(mockCookies.set).toHaveBeenCalledWith(
        CSRF_TOKEN_NAME,
        token,
        expect.objectContaining({
          httpOnly: false, // Must be readable by client for double-submit
          sameSite: 'lax',
          path: '/',
          maxAge: 3600,
        })
      );
    });

    it('should set secure flag in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });

      const token = 'test-token';
      await setCsrfCookie(token);

      expect(mockCookies.set).toHaveBeenCalledWith(
        CSRF_TOKEN_NAME,
        token,
        expect.objectContaining({
          secure: true,
        })
      );

      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('getCsrfTokenFromCookie', () => {
    it('should return token when cookie exists', async () => {
      const expectedToken = 'test-token';
      mockCookies.get.mockReturnValue({ value: expectedToken });

      const token = await getCsrfTokenFromCookie();
      expect(token).toBe(expectedToken);
    });

    it('should return undefined when cookie does not exist', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const token = await getCsrfTokenFromCookie();
      expect(token).toBeUndefined();
    });
  });

  describe('initializeCsrfToken', () => {
    it('should return existing token if present', async () => {
      const existingToken = 'existing-token';
      mockCookies.get.mockReturnValue({ value: existingToken });

      const token = await initializeCsrfToken();
      expect(token).toBe(existingToken);
      expect(mockCookies.set).not.toHaveBeenCalled();
    });

    it('should generate and set new token if none exists', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const token = await initializeCsrfToken();
      expect(token).toBeTruthy();
      expect(token).toHaveLength(64); // 32 bytes hex = 64 characters
      expect(mockCookies.set).toHaveBeenCalledWith(
        CSRF_TOKEN_NAME,
        token,
        expect.any(Object)
      );
    });

    it('should generate cryptographically random tokens', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const token1 = await initializeCsrfToken();
      vi.clearAllMocks();
      mockCookies.get.mockReturnValue(undefined);
      const token2 = await initializeCsrfToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('clearCsrfToken', () => {
    it('should clear cookie with correct attributes', async () => {
      await clearCsrfToken();

      expect(mockCookies.set).toHaveBeenCalledWith(
        CSRF_TOKEN_NAME,
        '',
        expect.objectContaining({
          httpOnly: false, // Must match setting used when creating cookie
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
        })
      );
    });

    it('should use same httpOnly value as setCsrfCookie for proper deletion', async () => {
      await clearCsrfToken();

      const clearCall = mockCookies.set.mock.calls[0];
      const clearOptions = clearCall[2];

      // Should use httpOnly: false to match setCsrfCookie
      expect(clearOptions.httpOnly).toBe(false);
    });
  });

  describe('Security Edge Cases', () => {
    it('should reject empty string tokens', async () => {
      mockCookies.get.mockReturnValue({ value: '' });

      const request = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_HEADER]: '',
        },
      });

      const result = await validateCsrfToken(request);
      expect(result).toBe(false); // Empty strings are rejected for security
    });

    it('should handle unicode characters in tokens', async () => {
      // Note: HTTP headers can't contain Unicode, but we test the scenario
      // where a cookie might somehow have Unicode characters
      const unicodeToken = '🔒token🔑';
      const asciiToken = 'token123';
      mockCookies.get.mockReturnValue({ value: unicodeToken });

      const request = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_HEADER]: asciiToken, // ASCII token in header (what HTTP allows)
        },
      });

      const result = await validateCsrfToken(request);
      // Unicode cookie token won't match ASCII header token
      expect(result).toBe(false);
    });

    it('should handle very long tokens', async () => {
      const longToken = 'a'.repeat(10000);
      mockCookies.get.mockReturnValue({ value: longToken });

      const request = new Request('http://localhost', {
        method: 'POST',
        headers: {
          [CSRF_HEADER]: longToken,
        },
      });

      const result = await validateCsrfToken(request);
      expect(result).toBe(true);
    });
  });
});
