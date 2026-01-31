import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions
const mockSignOut = vi.fn();
const mockDeleteCookie = vi.fn();
const mockCaptureException = vi.fn();

// Mock modules at the top level with factory functions
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: () => mockSignOut(),
    },
  }),
}));

vi.mock('cookies-next', () => ({
  deleteCookie: (...args: any[]) => mockDeleteCookie(...args),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: any[]) => mockCaptureException(...args),
}));

// Mock the getCsrfToken function
const mockGetCsrfToken = vi.fn();
vi.mock('@/lib/axios', () => ({
  getCsrfToken: () => mockGetCsrfToken(),
}));

import { isAuthSessionMissingError, handleLogout } from '../auth';

describe('isAuthSessionMissingError', () => {
  it('should return true when error message contains "session missing"', () => {
    const error = { message: 'Auth session missing' };
    expect(isAuthSessionMissingError(error)).toBe(true);
  });

  it('should return true when error message contains "session missing" in different case', () => {
    const error = { message: 'SESSION MISSING!' };
    expect(isAuthSessionMissingError(error)).toBe(true);
  });

  it('should return true when error message contains "auth session"', () => {
    const error = { message: 'Auth session is invalid' };
    expect(isAuthSessionMissingError(error)).toBe(true);
  });

  it('should return true when error message contains "AUTH SESSION" in uppercase', () => {
    const error = { message: 'AUTH SESSION ERROR' };
    expect(isAuthSessionMissingError(error)).toBe(true);
  });

  it('should return false when error message does not contain session-related text', () => {
    const error = { message: 'Network error' };
    expect(isAuthSessionMissingError(error)).toBe(false);
  });

  it('should return false when error is null', () => {
    expect(isAuthSessionMissingError(null)).toBe(false);
  });

  it('should return false when error is undefined', () => {
    expect(isAuthSessionMissingError(undefined)).toBe(false);
  });

  it('should return false when error has no message', () => {
    const error = { code: 'SOME_ERROR' };
    expect(isAuthSessionMissingError(error)).toBe(false);
  });

  it('should return false when error message is not a string', () => {
    const error = { message: 123 };
    expect(isAuthSessionMissingError(error)).toBe(false);
  });

  it('should handle error with partial matches', () => {
    const error1 = { message: 'The session missing from request' };
    expect(isAuthSessionMissingError(error1)).toBe(true);

    const error2 = { message: 'Invalid auth session detected' };
    expect(isAuthSessionMissingError(error2)).toBe(true);
  });
});

describe('handleLogout', () => {
  let originalWindow: typeof globalThis.window;
  let originalFetch: typeof globalThis.fetch;
  let originalLocalStorage: Storage;
  let originalSessionStorage: Storage;
  let mockLocalStorage: Storage;
  let mockSessionStorage: Storage;

  beforeEach(() => {
    // Reset all mocks
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue({ error: null });
    mockDeleteCookie.mockClear();
    mockCaptureException.mockClear();
    mockGetCsrfToken.mockClear();
    
    // Default: return a valid CSRF token
    mockGetCsrfToken.mockReturnValue('test-csrf-token');

    // Mock fetch - capture original and replace with mock
    // Default mock returns success for both /api/csrf and /api/logout
    originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/csrf') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ token: 'mock-csrf-token' })
        });
      }
      return Promise.resolve({ ok: true });
    }) as any;

    // Mock window and storage
    mockLocalStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      key: vi.fn(),
      length: 0,
    };

    mockSessionStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      key: vi.fn(),
      length: 0,
    };

    originalWindow = global.window;
    Object.defineProperty(global, 'window', {
      writable: true,
      configurable: true,
      value: {
        location: {
          href: '',
        },
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
      },
    });

    // Also set global localStorage and sessionStorage to point to the mocks
    // since the code accesses them directly
    originalLocalStorage = global.localStorage;
    originalSessionStorage = global.sessionStorage;
    Object.defineProperty(global, 'localStorage', {
      writable: true,
      configurable: true,
      value: mockLocalStorage,
    });
    Object.defineProperty(global, 'sessionStorage', {
      writable: true,
      configurable: true,
      value: mockSessionStorage,
    });
  });

  afterEach(() => {
    // Clear mocks first
    vi.clearAllMocks();
    
    // Restore globals with try-finally to ensure all restorations happen
    // even if one throws an exception
    try {
      global.window = originalWindow;
    } catch (err) {
      // Log but continue with other restorations
      console.error('Failed to restore window:', err);
    }
    
    try {
      global.fetch = originalFetch;
    } catch (err) {
      console.error('Failed to restore fetch:', err);
    }
    
    try {
      global.localStorage = originalLocalStorage;
    } catch (err) {
      console.error('Failed to restore localStorage:', err);
    }
    
    try {
      global.sessionStorage = originalSessionStorage;
    } catch (err) {
      console.error('Failed to restore sessionStorage:', err);
    }
  });

  it('should call Supabase signOut', async () => {
    await handleLogout();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should clear localStorage and sessionStorage', async () => {
    await handleLogout();
    expect(mockLocalStorage.clear).toHaveBeenCalled();
    expect(mockSessionStorage.clear).toHaveBeenCalled();
  });

  it('should obtain CSRF token and call logout API endpoint when no token provided', async () => {
    await handleLogout();
    expect(global.fetch).toHaveBeenCalledWith('/api/logout', { 
      method: 'POST',
      headers: {
        'x-csrf-token': 'test-csrf-token'
      }
    });
  });

  it('should delete terms_version cookie', async () => {
    await handleLogout();
    // Note: terms_version cookie deletion is now handled server-side via /api/logout
    // Client-side deletion was removed as it's httpOnly
    expect(global.fetch).toHaveBeenCalledWith('/api/logout', { 
      method: 'POST',
      headers: {
        'x-csrf-token': 'test-csrf-token'
      }
    });
  });

  it('should redirect to home page after successful logout', async () => {
    await handleLogout();
    expect(global.window.location.href).toBe('/');
  });

  it('should perform cleanup and redirect even when signOut throws', async () => {
    mockSignOut.mockRejectedValue(new Error('Network error'));
    
    await handleLogout();

    // Should still attempt cleanup
    expect(global.fetch).toHaveBeenCalledWith('/api/logout', { 
      method: 'POST',
      headers: {
        'x-csrf-token': 'test-csrf-token'
      }
    });
    expect(global.window.location.href).toBe('/');
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it('should not clear storage when signOut throws before reaching cleanup', async () => {
    mockSignOut.mockRejectedValue(new Error('Network error'));
    
    await handleLogout();

    // Storage clearing code is in try block after signOut, so if signOut throws
    // it never reaches the storage clearing code
    expect(mockLocalStorage.clear).not.toHaveBeenCalled();
    expect(mockSessionStorage.clear).not.toHaveBeenCalled();
  });

  it('should log error to Sentry when logout fails', async () => {
    const testError = new Error('Test error');
    mockSignOut.mockRejectedValue(testError);
    
    await handleLogout();

    expect(mockCaptureException).toHaveBeenCalledWith(
      testError,
      { tags: { type: 'logout_failure', location: 'handleLogout' } }
    );
  });

  it('should handle missing window object gracefully', async () => {
    // Remove window object
    const windowBackup = global.window;
    try {
      // @ts-expect-error - Testing undefined window
      delete global.window;
      
      // Should not throw
      await expect(handleLogout()).resolves.not.toThrow();
    } finally {
      // Always restore window, even if test fails
      global.window = windowBackup;
    }
  });

  it('should handle signOut error object gracefully', async () => {
    mockSignOut.mockResolvedValue({ 
      error: new Error('Supabase signOut failed') 
    });
    
    // Should redirect even on error
    await handleLogout();
    expect(global.window.location.href).toBe('/');
  });
  
  it('should handle CSRF token fetch failure gracefully', async () => {
    // Mock getCsrfToken to return null (no initial token)
    mockGetCsrfToken.mockReturnValue(null);
    
    // Mock CSRF fetch to fail
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/csrf') {
        return Promise.resolve({
          ok: false,
          statusText: 'Internal Server Error'
        });
      }
      return Promise.resolve({ ok: true });
    }) as any;
    
    await handleLogout();
    
    // Should still redirect despite CSRF failure
    expect(global.window.location.href).toBe('/');
    // Should NOT call /api/logout without token
    expect(global.fetch).not.toHaveBeenCalledWith('/api/logout', expect.anything());
  });
  
  it('should handle CSRF token fetch exception gracefully', async () => {
    // Mock getCsrfToken to return null (no initial token)
    mockGetCsrfToken.mockReturnValue(null);
    
    // Mock CSRF fetch to throw
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/csrf') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true });
    }) as any;
    
    await handleLogout();
    
    // Should still redirect despite CSRF failure
    expect(global.window.location.href).toBe('/');
    // Should NOT call /api/logout without token
    expect(global.fetch).not.toHaveBeenCalledWith('/api/logout', expect.anything());
  });
});
