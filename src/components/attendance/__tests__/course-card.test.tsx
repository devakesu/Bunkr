import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CourseCard } from '../course-card';

vi.mock('@/hooks/courses/attendance', () => ({
  useCourseDetails: vi.fn(() => ({
    data: { present: 15, total: 20, absent: 5 },
    isLoading: false,
  })),
}));

vi.mock('@/hooks/users/user', () => ({
  useUser: () => ({
    data: { id: '123', email: 'test@example.com', username: 'testuser' },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/tracker/useTrackingData', () => ({
  useTrackingData: vi.fn(() => ({
    data: null,
    isLoading: false,
  })),
}));

vi.mock('@/providers/attendance-settings', () => ({
  useAttendanceSettings: () => ({
    targetPercentage: 75,
    absenceIncludesOtherLeave: false,
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
    },
  })),
}));

vi.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="alert-circle-icon" />,
}));

const sampleCourse = {
  id: 42,
  name: 'Computer Science',
  code: 'CS101',
  present: 15,
  total: 20,
};

describe('CourseCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should render the course name', async () => {
    render(<CourseCard course={sampleCourse as any} />);

    expect(await screen.findByText('Computer Science')).toBeInTheDocument();
  });

  it('should render the course code badge', async () => {
    render(<CourseCard course={sampleCourse as any} />);

    expect(await screen.findByText('CS101')).toBeInTheDocument();
  });

  it('should render attendance stats when data is available', async () => {
    render(<CourseCard course={sampleCourse as any} />);

    expect(await screen.findByText('Present')).toBeInTheDocument();
    expect(await screen.findByText('Absent')).toBeInTheDocument();
    expect(await screen.findByText('Total')).toBeInTheDocument();
  });
});
