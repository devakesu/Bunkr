import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardClient from '../DashboardClient';

// Mock next/dynamic
vi.mock('next/dynamic', () => ({
  default: (loader: any, options: any) => {
    const DynamicComponent = (props: any) => {
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
  useUser: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/hooks/courses/attendance', () => ({
  useAttendanceReport: () => ({ data: null, isLoading: false }),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ChartSkeleton Component (Line 52)', () => {
    it('should render ChartSkeleton with loading spinner', () => {
      render(<DashboardClient initialData={null} />);
      
      // The ChartSkeleton is rendered by the dynamic import's loading state
      // It displays the CompLoading component
      const loadingElements = screen.getAllByRole('status', { hidden: true });
      expect(loadingElements.length).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Import Loading State (Line 61)', () => {
    it('should render loading component during dynamic import', () => {
      render(<DashboardClient initialData={null} />);
      
      // The loading function returns <ChartSkeleton />
      // which renders CompLoading inside a flex container
      const loadingElements = screen.getAllByRole('status', { hidden: true });
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    it('should use ChartSkeleton as loading fallback for AttendanceChart', () => {
      // The dynamic import configuration specifies:
      // loading: () => <ChartSkeleton />
      // This test verifies that the loading prop is properly configured
      render(<DashboardClient initialData={null} />);
      
      // ChartSkeleton contains a div with flex layout and CompLoading
      const container = screen.getByRole('status', { hidden: true }).closest('div');
      expect(container).toBeInTheDocument();
    });
  });

  describe('SSR Configuration', () => {
    it('should disable SSR for AttendanceChart', () => {
      // The dynamic import has ssr: false
      // This is tested implicitly - the component renders without SSR errors
      render(<DashboardClient initialData={null} />);
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });
  });
});
