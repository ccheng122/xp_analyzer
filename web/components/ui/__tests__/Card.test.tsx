import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>hello</Card>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('uses bg-surface by default', () => {
    render(<Card>x</Card>)
    expect(screen.getByTestId('ui-card')).toHaveClass('bg-surface')
  })

  it('uses bg-surface-subtle when subtle is true', () => {
    render(<Card subtle>x</Card>)
    const el = screen.getByTestId('ui-card')
    expect(el).toHaveClass('bg-surface-subtle')
    expect(el).not.toHaveClass('bg-surface')
  })

  it('applies border, radius, and padding tokens', () => {
    render(<Card>x</Card>)
    expect(screen.getByTestId('ui-card')).toHaveClass(
      'border',
      'border-border',
      'rounded-card',
      'px-card-x',
      'py-card-y'
    )
  })

  it('appends caller className', () => {
    render(<Card className="custom-class">x</Card>)
    expect(screen.getByTestId('ui-card')).toHaveClass('custom-class')
  })
})
