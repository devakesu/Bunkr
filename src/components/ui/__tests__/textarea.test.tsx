import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Textarea } from '@/components/ui/textarea'

describe('Textarea', () => {
  it('should render textarea', () => {
    render(<Textarea aria-label="Test textarea" />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
  })

  it('should render with placeholder', () => {
    render(<Textarea placeholder="Enter text here" />)
    expect(screen.getByPlaceholderText('Enter text here')).toBeInTheDocument()
  })

  it('should handle onChange events', () => {
    const handleChange = vi.fn()
    render(<Textarea onChange={handleChange} aria-label="Test textarea" />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello World' } })
    expect(handleChange).toHaveBeenCalled()
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Textarea disabled aria-label="Test textarea" />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
  })

  it('should apply custom className', () => {
    render(<Textarea className="custom-textarea" aria-label="Test textarea" />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveClass('custom-textarea')
  })

  it('should render with default value', () => {
    render(<Textarea defaultValue="Initial text" aria-label="Test textarea" />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('Initial text')
  })

  it('should handle rows attribute', () => {
    render(<Textarea rows={5} aria-label="Test textarea" />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('rows', '5')
  })
})
