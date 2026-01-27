import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Checkbox } from '@/components/ui/checkbox'

describe('Checkbox', () => {
  it('should render checkbox', () => {
    render(<Checkbox aria-label="Test checkbox" />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
  })

  it('should handle checked state', () => {
    render(<Checkbox checked aria-label="Test checkbox" />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  it('should handle click events', () => {
    const handleClick = vi.fn()
    render(<Checkbox onClick={handleClick} aria-label="Test checkbox" />)
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(handleClick).toHaveBeenCalled()
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Checkbox disabled aria-label="Test checkbox" />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeDisabled()
  })

  it('should apply custom className', () => {
    render(<Checkbox className="custom-checkbox" aria-label="Test checkbox" />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveClass('custom-checkbox')
  })
})
