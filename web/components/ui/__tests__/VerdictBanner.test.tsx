import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerdictBanner } from '../VerdictBanner'

describe('VerdictBanner', () => {
  it('renders title and body', () => {
    render(<VerdictBanner title="Ship it" body="Primary metric improved" />)
    expect(screen.getByText('Ship it')).toBeInTheDocument()
    expect(screen.getByText('Primary metric improved')).toBeInTheDocument()
  })

  it('defaults to neutral tone with slate accent', () => {
    render(<VerdictBanner title="x" body="y" />)
    const el = screen.getByTestId('ui-verdict-banner')
    expect(el).toHaveAttribute('data-tone', 'neutral')
    expect(el).toHaveClass('border-l-border-strong')
  })

  it('uses success accent for success tone', () => {
    render(<VerdictBanner title="x" body="y" tone="success" />)
    const el = screen.getByTestId('ui-verdict-banner')
    expect(el).toHaveAttribute('data-tone', 'success')
    expect(el).toHaveClass('border-l-success')
    expect(el).not.toHaveClass('border-l-danger')
  })

  it('uses danger accent for danger tone', () => {
    render(<VerdictBanner title="x" body="y" tone="danger" />)
    const el = screen.getByTestId('ui-verdict-banner')
    expect(el).toHaveAttribute('data-tone', 'danger')
    expect(el).toHaveClass('border-l-danger')
  })

  it('uses surface-subtle bg with border-l-4 and rounded-card', () => {
    render(<VerdictBanner title="x" body="y" />)
    const el = screen.getByTestId('ui-verdict-banner')
    expect(el).toHaveClass('bg-surface-subtle', 'border-l-4', 'rounded-card')
  })

  it('renders title in font-medium and body in font-regular', () => {
    render(<VerdictBanner title="title-text" body="body-text" />)
    expect(screen.getByText('title-text')).toHaveClass('font-medium', 'text-label')
    expect(screen.getByText('body-text')).toHaveClass('font-regular', 'text-label')
  })
})
