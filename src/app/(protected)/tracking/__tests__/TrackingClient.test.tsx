import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrackingClient from '../TrackingClient';

// Mock all required hooks
vi.mock('@/hooks/tracker/useTrackingData', () => ({
  useTrackingData: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/hooks/tracker/useTrackingCount', () => ({
  useTrackingCount: vi.fn(() => ({
    data: 0,
    isLoading: false,
  })),
}));

vi.mock('@/hooks/users/user', () => ({
  useUser: () => ({
    data: { id: '123', email: 'test@example.com', username: 'testuser' },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/courses/attendance', () => ({
  useAttendanceReport: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/users/settings', () => ({
  useFetchSemester: () => ({
    data: '1',
    isLoading: false,
  }),
  useFetchAcademicYear: () => ({
    data: '2024',
    isLoading: false,
  }),
}));

vi.mock('@/hooks/courses/courses', () => ({
  useFetchCourses: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    dev: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  LazyMotion: ({ children }: any) => children,
  domAnimation: {},
  m: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('TrackingClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Ternary Operator - Singular vs Plural (Line 545)', () => {
    it('should display "record" for count of 1', async () => {
      const user = userEvent.setup();
      const { useTrackingCount } = await import('@/hooks/tracker/useTrackingCount');
      const { useTrackingData } = await import('@/hooks/tracker/useTrackingData');
      
      vi.mocked(useTrackingCount).mockReturnValue({
        data: 1,
        isLoading: false,
      } as any);

      vi.mocked(useTrackingData).mockReturnValue({
        data: [{
          id: 1,
          course: 'CS101',
          date: '2024-01-01',
          session: '1',
          semester: '1',
          year: '2024',
          auth_user_id: '123',
        }],
        isLoading: false,
        error: null,
      } as any);

      // Mock sync completion
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<TrackingClient />);

      // Wait for sync to complete
      await waitFor(() => {
        expect(screen.queryByText(/syncing/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Click "Clear all" button to open dialog
      const deleteAllButton = screen.getByRole('button', { name: /clear all/i });
      await user.click(deleteAllButton);

      // Verify singular "record" is used
      await waitFor(() => {
        expect(screen.getByText(/1 tracking record/i)).toBeInTheDocument();
      });
    });

    it('should display "records" for count of 0', async () => {
      const user = userEvent.setup();
      const { useTrackingCount } = await import('@/hooks/tracker/useTrackingCount');
      const { useTrackingData } = await import('@/hooks/tracker/useTrackingData');
      
      vi.mocked(useTrackingCount).mockReturnValue({
        data: 0,
        isLoading: false,
      } as any);

      vi.mocked(useTrackingData).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as any);

      // Mock sync completion
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<TrackingClient />);

      // Wait for sync to complete
      await waitFor(() => {
        expect(screen.queryByText(/syncing/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Click "Clear all" button to open dialog
      const deleteAllButton = screen.getByRole('button', { name: /clear all/i });
      await user.click(deleteAllButton);

      // Verify plural "records" is used for 0
      await waitFor(() => {
        expect(screen.getByText(/0 tracking records/i)).toBeInTheDocument();
      });
    });

    it('should display "records" for count greater than 1', async () => {
      const user = userEvent.setup();
      const { useTrackingCount } = await import('@/hooks/tracker/useTrackingCount');
      const { useTrackingData } = await import('@/hooks/tracker/useTrackingData');
      
      vi.mocked(useTrackingCount).mockReturnValue({
        data: 5,
        isLoading: false,
      } as any);

      vi.mocked(useTrackingData).mockReturnValue({
        data: [
          { id: 1, course: 'CS101', date: '2024-01-01', session: '1', semester: '1', year: '2024', auth_user_id: '123' },
          { id: 2, course: 'CS102', date: '2024-01-02', session: '2', semester: '1', year: '2024', auth_user_id: '123' },
          { id: 3, course: 'CS103', date: '2024-01-03', session: '3', semester: '1', year: '2024', auth_user_id: '123' },
          { id: 4, course: 'CS104', date: '2024-01-04', session: '4', semester: '1', year: '2024', auth_user_id: '123' },
          { id: 5, course: 'CS105', date: '2024-01-05', session: '5', semester: '1', year: '2024', auth_user_id: '123' },
        ],
        isLoading: false,
        error: null,
      } as any);

      // Mock sync completion
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<TrackingClient />);

      // Wait for sync to complete
      await waitFor(() => {
        expect(screen.queryByText(/syncing/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Click "Clear all" button to open dialog
      const deleteAllButton = screen.getByRole('button', { name: /clear all/i });
      await user.click(deleteAllButton);

      // Verify plural "records" is used
      await waitFor(() => {
        expect(screen.getByText(/5 tracking records/i)).toBeInTheDocument();
      });
    });
  });
});
