import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiagnosticRow } from '../DiagnosticRow'

describe('DiagnosticRow', () => {
  it('renders the label', () => {
    render(<DiagnosticRow label="SRM check" status="pass" />)
    expect(screen.getByText('SRM check')).toBeInTheDocument()
  })

  it('puts the label in muted color', () => {
    render(<DiagnosticRow label="SRM check" status="pass" />)
    expect(screen.getByText('SRM check')).toHaveClass('text-muted')
  })

  it('renders ✓ in success color for pass', () => {
    render(<DiagnosticRow label="x" status="pass" />)
    expect(screen.getByTestId('ui-diagnostic-row')).toHaveAttribute('data-status', 'pass')
    expect(screen.getByText('✓')).toHaveClass('text-success')
  })

  it('renders ⚠ in warning color for flag', () => {
    render(<DiagnosticRow label="x" status="flag" />)
    expect(screen.getByText('⚠')).toHaveClass('text-warning')
  })

  it('renders ✗ in danger color for fail', () => {
    render(<DiagnosticRow label="x" status="fail" />)
    expect(screen.getByText('✗')).toHaveClass('text-danger')
  })

  it('renders — in muted color for not-run', () => {
    render(<DiagnosticRow label="x" status="not-run" />)
    expect(screen.getByText('—')).toHaveClass('text-muted')
  })

  it('exposes status as aria-label on the glyph', () => {
    render(<DiagnosticRow label="x" status="fail" />)
    expect(screen.getByText('✗')).toHaveAttribute('aria-label', 'fail')
  })
})
