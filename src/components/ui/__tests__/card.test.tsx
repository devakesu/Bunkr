import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

describe('Card', () => {
  it('should render card with all parts', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>Card Content</CardContent>
        <CardFooter>Card Footer</CardFooter>
      </Card>
    )

    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Card Description')).toBeInTheDocument()
    expect(screen.getByText('Card Content')).toBeInTheDocument()
    expect(screen.getByText('Card Footer')).toBeInTheDocument()
  })

  it('should apply custom className to Card', () => {
    const { container } = render(<Card className="custom-card">Content</Card>)
    expect(container.firstChild).toHaveClass('custom-card')
  })

  it('should render CardHeader with custom className', () => {
    const { container } = render(<CardHeader className="custom-header">Header</CardHeader>)
    expect(container.firstChild).toHaveClass('custom-header')
  })

  it('should render CardTitle with custom className', () => {
    render(<CardTitle className="custom-title">Title</CardTitle>)
    expect(screen.getByText('Title')).toHaveClass('custom-title')
  })

  it('should render CardContent with custom className', () => {
    const { container } = render(<CardContent className="custom-content">Content</CardContent>)
    expect(container.firstChild).toHaveClass('custom-content')
  })
})
