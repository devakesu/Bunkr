import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { useAttendanceReport } from '@/hooks/courses/attendance'
import axiosInstance from '@/lib/axios'

vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn(),
  },
}))

describe('useAttendanceReport', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    Wrapper.displayName = 'QueryClientWrapper'
    return Wrapper
  }

  it('should fetch attendance report data successfully', async () => {
    const mockAttendanceReport = {
      totalClasses: 100,
      attendedClasses: 85,
      percentage: 85,
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
      .mockRejectedValueOnce(new Error('Network error')) // Second rejection for retry

    const { result } = renderHook(() => useAttendanceReport(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    }, { timeout: 3000 })
  })

  it('should respect enabled option', () => {
    const { result } = renderHook(() => useAttendanceReport({ enabled: false }), {
      wrapper: createWrapper(),
    })

    expect(result.current.status).toBe('pending')
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('should normalize null initialData to undefined and trigger fetch', async () => {
    const mockAttendanceReport = {
      totalClasses: 100,
      attendedClasses: 85,
      percentage: 85,
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
    const mockInitialData = {
      totalClasses: 50,
      attendedClasses: 40,
      percentage: 80,
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
