import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationsPage from '../NotificationsClient';

// Mock all required hooks and dependencies
vi.mock('@/hooks/notifications/useNotifications', () => ({
  useNotifications: () => ({
    actionNotifications: [],
    regularNotifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  }),
}));

vi.mock('@/hooks/users/user', () => ({
  useUser: () => ({
    data: { id: '123', email: 'test@example.com' },
    isLoading: false,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 0,
    getVirtualItems: () => [],
    scrollToIndex: vi.fn(),
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    dev: vi.fn(),
  },
}));

describe('NotificationsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CSS Hover Effects (Line 47)', () => {
    it('should apply hover:shadow-md class to unread notifications', async () => {
      const { useNotifications } = await import('@/hooks/notifications/useNotifications');
      
      vi.mocked(useNotifications).mockReturnValue({
        actionNotifications: [],
        regularNotifications: [
          {
            id: 1,
            title: 'Test Notification',
            description: 'Test description',
            is_read: false,
            created_at: new Date().toISOString(),
            user_id: '123',
            topic: 'sync',
          },
        ],
        unreadCount: 1,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
      } as any);

      render(<NotificationsPage />);

      await waitFor(() => {
        const notification = screen.getByText('Test Notification').closest('div[role="button"]');
        expect(notification).toBeInTheDocument();
        // Verify the hover:shadow-md class is present
        expect(notification?.className).toContain('hover:shadow-md');
      });
    });

    it('should not apply hover:shadow-md class to read notifications', async () => {
      const { useNotifications } = await import('@/hooks/notifications/useNotifications');
      
      vi.mocked(useNotifications).mockReturnValue({
        actionNotifications: [],
        regularNotifications: [
          {
            id: 1,
            title: 'Read Notification',
            description: 'Test description',
            is_read: true,
            created_at: new Date().toISOString(),
            user_id: '123',
            topic: 'sync',
          },
        ],
        unreadCount: 0,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
      } as any);

      render(<NotificationsPage />);

      await waitFor(() => {
        const notification = screen.getByText('Read Notification').closest('div[role="button"]');
        expect(notification).toBeInTheDocument();
        // Read notifications should not have hover:shadow-md
        expect(notification?.className).not.toContain('hover:shadow-md');
      });
    });

    it('should apply cursor-pointer class for unread notifications', async () => {
      const { useNotifications } = await import('@/hooks/notifications/useNotifications');
      
      vi.mocked(useNotifications).mockReturnValue({
        actionNotifications: [],
        regularNotifications: [
          {
            id: 1,
            title: 'Unread Notification',
            description: 'Test description',
            is_read: false,
            created_at: new Date().toISOString(),
            user_id: '123',
            topic: 'attendance',
          },
        ],
        unreadCount: 1,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
      } as any);

      render(<NotificationsPage />);

      await waitFor(() => {
        const notification = screen.getByText('Unread Notification').closest('div[role="button"]');
        expect(notification).toBeInTheDocument();
        expect(notification?.className).toContain('cursor-pointer');
      });
    });
  });
});
