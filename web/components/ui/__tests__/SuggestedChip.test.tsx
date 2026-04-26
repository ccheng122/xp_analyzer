import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuggestedChip } from '../SuggestedChip'

describe('SuggestedChip', () => {
  it('renders the label', () => {
    render(<SuggestedChip label="Why is the lift positive?" onClick={() => {}} />)
    expect(screen.getByText('Why is the lift positive?')).toBeInTheDocument()
  })

  it('renders as a button with type=button', () => {
    render(<SuggestedChip label="x" onClick={() => {}} />)
    const btn = screen.getByTestId('ui-suggested-chip')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<SuggestedChip label="x" onClick={onClick} />)
    await userEvent.click(screen.getByTestId('ui-suggested-chip'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies pill shape and surface-subtle bg tokens', () => {
    render(<SuggestedChip label="x" onClick={() => {}} />)
    expect(screen.getByTestId('ui-suggested-chip')).toHaveClass(
      'rounded-pill',
      'bg-surface-subtle',
      'text-meta'
    )
  })
})
