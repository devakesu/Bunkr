import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from '@/components/ui/skeleton'

describe('Skeleton', () => {
  it('should render skeleton element', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(<Skeleton className="custom-skeleton" />)
    expect(container.firstChild).toHaveClass('custom-skeleton')
  })

  it('should render multiple skeletons', () => {
    const { container } = render(
      <div>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    )
    const skeletons = container.querySelectorAll('div[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  it('should accept style props', () => {
    const { container } = render(<Skeleton style={{ width: '100px', height: '20px' }} />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton.style.width).toBe('100px')
    expect(skeleton.style.height).toBe('20px')
  })
})
