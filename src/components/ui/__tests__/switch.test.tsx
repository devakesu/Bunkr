import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Switch } from '@/components/ui/switch'

describe('Switch', () => {
  it('should render switch', () => {
    render(<Switch aria-label="Test switch" />)
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toBeInTheDocument()
  })

  it('should handle checked state', () => {
    render(<Switch checked aria-label="Test switch" />)
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toBeChecked()
  })

  it('should handle click events', () => {
    const handleClick = vi.fn()
    render(<Switch onClick={handleClick} aria-label="Test switch" />)
    const switchElement = screen.getByRole('switch')
    fireEvent.click(switchElement)
    expect(handleClick).toHaveBeenCalled()
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Switch disabled aria-label="Test switch" />)
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toBeDisabled()
  })

  it('should apply custom className', () => {
    render(<Switch className="custom-switch" aria-label="Test switch" />)
    const switchElement = screen.getByRole('switch')
    expect(switchElement).toHaveClass('custom-switch')
  })
})
