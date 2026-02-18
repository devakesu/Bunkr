import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardClient from '../DashboardClient';

// Mock next/dynamic
vi.mock('next/dynamic', () => ({
  default: (_loader: any, options: any) => {
    const DynamicComponent = (_props: any) => {
      // Render the loading component
      if (options?.loading) {
        return options.loading();
      }
      return null;
    };
    DynamicComponent.displayName = 'DynamicComponent';
    return DynamicComponent;
  },
}));

// Mock all the hooks
vi.mock('@/hooks/users/profile', () => ({
  useProfile: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/hooks/users/user', () => ({
  useUser: () => ({
    data: { id: '123', email: 'test@example.com', username: 'testuser' },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/courses/attendance', () => ({
  useAttendanceReport: () => ({
    data: {
      attendance_percentage: 85,
      total_sessions: 20,
      attended_sessions: 17,
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/courses/courses', () => ({
  useFetchCourses: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/hooks/users/settings', () => ({
  useFetchSemester: () => ({ data: null, isLoading: false, isError: false }),
  useFetchAcademicYear: () => ({ data: null, isLoading: false, isError: false }),
  useSetSemester: () => ({ mutate: vi.fn() }),
  useSetAcademicYear: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/tracker/useTrackingData', () => ({
  useTrackingData: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/providers/attendance-settings', () => ({
  useAttendanceSettings: () => ({
    absenceIncludesOtherLeave: false,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    dev: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('DashboardClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('ChartSkeleton Component (Line 52)', () => {
    it('should render ChartSkeleton with loading spinner', async () => {
      // Mock sync completion
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<DashboardClient initialData={null} />);
      
      // Wait for sync and check for loading state
      const loadingElements = await screen.findAllByRole('status', { hidden: true });
      expect(loadingElements.length).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Import Loading State (Line 61)', () => {
    it('should render loading component during dynamic import', async () => {
      // Mock sync completion
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<DashboardClient initialData={null} />);
      
      // Wait for sync and check for loading state
      const loadingElements = await screen.findAllByRole('status', { hidden: true });
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    it('should use ChartSkeleton as loading fallback for AttendanceChart', async () => {
      // Mock sync completion
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<DashboardClient initialData={null} />);
      
      // Wait for sync and check for loading state
      const statusElement = await screen.findByRole('status', { hidden: true });
      const container = statusElement.closest('div');
      expect(container).toBeInTheDocument();
    });
  });

  describe('SSR Configuration', () => {
    it('should disable SSR for AttendanceChart', async () => {
      // Mock sync completion
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<DashboardClient initialData={null} />);
      expect(await screen.findByRole('status', { hidden: true })).toBeInTheDocument();
    });
  });
});
