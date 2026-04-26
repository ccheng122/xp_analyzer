import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pill } from '../Pill'

describe('Pill', () => {
  it('renders children', () => {
    render(<Pill>Significant</Pill>)
    expect(screen.getByText('Significant')).toBeInTheDocument()
  })

  it('defaults to neutral variant', () => {
    render(<Pill>x</Pill>)
    const el = screen.getByTestId('ui-pill')
    expect(el).toHaveAttribute('data-variant', 'neutral')
    expect(el).toHaveClass('bg-surface-subtle', 'text-muted')
  })

  it('applies success token pair', () => {
    render(<Pill variant="success">x</Pill>)
    const el = screen.getByTestId('ui-pill')
    expect(el).toHaveAttribute('data-variant', 'success')
    expect(el).toHaveClass('bg-success-bg', 'text-success-fg')
    expect(el).not.toHaveClass('bg-danger-bg')
  })

  it('applies danger token pair', () => {
    render(<Pill variant="danger">x</Pill>)
    const el = screen.getByTestId('ui-pill')
    expect(el).toHaveAttribute('data-variant', 'danger')
    expect(el).toHaveClass('bg-danger-bg', 'text-danger-fg')
    expect(el).not.toHaveClass('bg-success-bg')
  })

  it('applies pill shape and type tokens', () => {
    render(<Pill>x</Pill>)
    expect(screen.getByTestId('ui-pill')).toHaveClass(
      'rounded-pill',
      'text-meta',
      'font-medium'
    )
  })
})
