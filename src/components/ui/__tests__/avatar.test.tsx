import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

describe('Avatar', () => {
  it('should render avatar container', () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="/test-image.jpg" alt="Test Avatar" />
        <AvatarFallback>TA</AvatarFallback>
      </Avatar>
    )
    expect(container.querySelector('[data-slot="avatar"]')).toBeInTheDocument()
  })

  it('should render fallback when image is not provided', () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('should apply custom className to Avatar', () => {
    const { container } = render(
      <Avatar className="custom-avatar">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )
    expect(container.firstChild).toHaveClass('custom-avatar')
  })

  it('should render AvatarImage', () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="/test.jpg" alt="Test" className="custom-image" />
        <AvatarFallback>XY</AvatarFallback>
      </Avatar>
    )
    expect(container.querySelector('[data-slot="avatar"]')).toBeInTheDocument()
  })

  it('should render AvatarFallback with custom className', () => {
    render(
      <Avatar>
        <AvatarFallback className="custom-fallback">XY</AvatarFallback>
      </Avatar>
    )
    const fallback = screen.getByText('XY')
    expect(fallback).toHaveClass('custom-fallback')
  })
})
