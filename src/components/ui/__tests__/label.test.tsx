import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Label } from '@/components/ui/label'

describe('Label', () => {
  it('should render with text', () => {
    render(<Label>Label Text</Label>)
    expect(screen.getByText('Label Text')).toBeInTheDocument()
  })

  it('should apply htmlFor attribute', () => {
    render(<Label htmlFor="input-id">Label Text</Label>)
    const label = screen.getByText('Label Text')
    expect(label).toHaveAttribute('for', 'input-id')
  })

  it('should apply custom className', () => {
    render(<Label className="custom-label">Label Text</Label>)
    expect(screen.getByText('Label Text')).toHaveClass('custom-label')
  })

  it('should be accessible with Input', () => {
    render(
      <div>
        <Label htmlFor="test-input">Test Label</Label>
        <input id="test-input" />
      </div>
    )
    const label = screen.getByText('Test Label')
    expect(label).toHaveAttribute('for', 'test-input')
  })
})
