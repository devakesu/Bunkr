import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUser } from '@/hooks/users/user'
import axiosInstance from '@/lib/axios'

vi.mock('@/lib/axios')
vi.mock('@/lib/auth', () => ({
  handleLogout: vi.fn(),
}))

describe('useUser', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  it('should fetch user data successfully', async () => {
    const mockUser = {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    }

    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: mockUser,
    })

    const { result } = renderHook(() => useUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockUser)
    })
  })

  it('should handle error state', async () => {
    vi.mocked(axiosInstance.get).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })
  })
})
