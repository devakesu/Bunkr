import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Separator } from '@/components/ui/separator'

describe('Separator', () => {
  it('should render separator', () => {
    const { container } = render(<Separator />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('should render with horizontal orientation by default', () => {
    const { container } = render(<Separator />)
    const separator = container.firstChild as HTMLElement
    expect(separator).toHaveAttribute('data-orientation', 'horizontal')
  })

  it('should render with vertical orientation', () => {
    const { container } = render(<Separator orientation="vertical" />)
    const separator = container.firstChild as HTMLElement
    expect(separator).toHaveAttribute('data-orientation', 'vertical')
  })

  it('should apply custom className', () => {
    const { container } = render(<Separator className="custom-separator" />)
    expect(container.firstChild).toHaveClass('custom-separator')
  })

  it('should be decorative by default', () => {
    const { container } = render(<Separator />)
    const separator = container.firstChild as HTMLElement
    expect(separator).toHaveAttribute('role', 'none')
  })
})
