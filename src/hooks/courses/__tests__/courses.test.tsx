import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { useFetchCourses } from '@/hooks/courses/courses'
import axiosInstance from '@/lib/axios'

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

describe('useFetchCourses', () => {
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

  it('should fetch courses data successfully', async () => {
    const mockCourses = [
      { id: 1, name: 'Course 1', code: 'CS101' },
      { id: 2, name: 'Course 2', code: 'CS102' },
    ]

    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: mockCourses,
    })

    const { result } = renderHook(() => useFetchCourses(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.courses).toBeDefined()
    expect(result.current.data?.courses['1']).toEqual(mockCourses[0])
    expect(result.current.data?.courses['2']).toEqual(mockCourses[1])
  })

  it('should handle error state', async () => {
    vi.mocked(axiosInstance.get).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useFetchCourses(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })

  it('should respect enabled option', () => {
    const { result } = renderHook(() => useFetchCourses({ enabled: false }), {
      wrapper: createWrapper(),
    })

    expect(result.current.status).toBe('pending')
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('should format courses into a map by id', async () => {
    const mockCourses = [
      { id: 10, name: 'Math', code: 'MATH101' },
      { id: 20, name: 'Physics', code: 'PHYS101' },
    ]

    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: mockCourses,
    })

    const { result } = renderHook(() => useFetchCourses(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(Object.keys(result.current.data?.courses || {})).toHaveLength(2)
    expect(result.current.data?.courses['10'].name).toBe('Math')
    expect(result.current.data?.courses['20'].name).toBe('Physics')
  })
})
