import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { useAttendanceReport } from '@/hooks/courses/attendance'
import { type AttendanceReport } from '@/types'
import axiosInstance from '@/lib/axios'

vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn(),
  },
}))

describe('useAttendanceReport', () => {
  beforeEach(() => {
    // Clear all mocks before each test to prevent state pollution
    vi.clearAllMocks()
  })

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { 
          retry: false,
          // Disable background refetching for tests
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          refetchInterval: false,
        },
      },
    })
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    Wrapper.displayName = 'QueryClientWrapper'
    return Wrapper
  }

  it('should fetch attendance report data successfully', async () => {
    const mockAttendanceReport: AttendanceReport = {
      courses: {},
      sessions: {},
      attendanceTypes: {},
      studentAttendanceData: {},
      attendanceDatesArray: {},
    }

    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: mockAttendanceReport,
    })

    const { result } = renderHook(() => useAttendanceReport(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockAttendanceReport)
  })

  it('should handle error state', async () => {
    vi.mocked(axiosInstance.post).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useAttendanceReport(), {
      wrapper: createWrapper(),
    })

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true)
      },
      { timeout: 3000 }
    )
  })

  it('should respect enabled option', () => {
    const { result } = renderHook(() => useAttendanceReport({ enabled: false }), {
      wrapper: createWrapper(),
    })

    expect(result.current.status).toBe('pending')
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('should fetch data when initialData is undefined', async () => {
    const mockAttendanceReport: AttendanceReport = {
      courses: {},
      sessions: {},
      attendanceTypes: {},
      studentAttendanceData: {},
      attendanceDatesArray: {},
    }

    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: mockAttendanceReport,
    })

    // Pass undefined (simulating null from SSR being normalized)
    const { result } = renderHook(
      () => useAttendanceReport({ initialData: undefined }),
      {
        wrapper: createWrapper(),
      }
    )

    // The query should fetch immediately when initialData is undefined
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockAttendanceReport)
    expect(axiosInstance.post).toHaveBeenCalledWith('/attendancereports/student/detailed')
  })

  it('should use initialData when provided and not trigger immediate fetch', () => {
    const mockInitialData: AttendanceReport = {
      courses: {},
      sessions: {},
      attendanceTypes: {},
      studentAttendanceData: {},
      attendanceDatesArray: {},
    }

    const { result } = renderHook(
      () => useAttendanceReport({ initialData: mockInitialData }),
      {
        wrapper: createWrapper(),
      }
    )

    // Should immediately have the initial data
    expect(result.current.data).toEqual(mockInitialData)
    expect(result.current.isSuccess).toBe(true)
    
    // Should not have called the API yet (using initialData)
    expect(axiosInstance.post).not.toHaveBeenCalled()
  })
})
