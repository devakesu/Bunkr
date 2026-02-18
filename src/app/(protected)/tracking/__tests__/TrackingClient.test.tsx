import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrackingClient from '../TrackingClient';

// Mock all required hooks
vi.mock('@/hooks/tracker/useTrackingData', () => ({
  useTrackingData: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/tracker/useTrackingCount', () => ({
  useTrackingCount: () => ({
    data: 0,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/users/user', () => ({
  useUser: () => ({
    data: { id: '123', email: 'test@example.com' },
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
        data: [{ id: 1, course_id: '101', date: '20240101', session: '1' }],
        isLoading: false,
        error: null,
      } as any);

      render(<TrackingClient />);

      // Click delete all button to open dialog
      const deleteAllButton = screen.getByRole('button', { name: /delete all/i });
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

      render(<TrackingClient />);

      // Click delete all button to open dialog
      const deleteAllButton = screen.getByRole('button', { name: /delete all/i });
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
          { id: 1, course_id: '101', date: '20240101', session: '1' },
          { id: 2, course_id: '102', date: '20240102', session: '2' },
          { id: 3, course_id: '103', date: '20240103', session: '3' },
          { id: 4, course_id: '104', date: '20240104', session: '4' },
          { id: 5, course_id: '105', date: '20240105', session: '5' },
        ],
        isLoading: false,
        error: null,
      } as any);

      render(<TrackingClient />);

      // Click delete all button to open dialog
      const deleteAllButton = screen.getByRole('button', { name: /delete all/i });
      await user.click(deleteAllButton);

      // Verify plural "records" is used
      await waitFor(() => {
        expect(screen.getByText(/5 tracking records/i)).toBeInTheDocument();
      });
    });
  });
});
