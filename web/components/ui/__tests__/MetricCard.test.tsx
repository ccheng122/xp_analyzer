import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCard } from '../MetricCard'

const baseProps = {
  name: 'Conversion rate',
  kind: 'primary' as const,
  description: 'proportion · higher is better',
  controlRate: 0.682,
  treatmentRate: 0.715,
  relativeLift: 0.048,
  pValue: 0.012,
  ciLower: 0.012,
  ciUpper: 0.084,
  direction: 'higher-is-better' as const,
  isSignificant: true,
  isViolation: false,
}

describe('MetricCard', () => {
  it('renders name and meta line (kind · description)', () => {
    render(<MetricCard {...baseProps} />)
    expect(screen.getByText('Conversion rate')).toBeInTheDocument()
    expect(
      screen.getByText('primary · proportion · higher is better')
    ).toBeInTheDocument()
  })

  it('uses success tone and Significant pill when significant and not a violation', () => {
    render(<MetricCard {...baseProps} />)
    const card = screen.getByTestId('ui-metric-card')
    expect(card).toHaveAttribute('data-tone', 'success')
    expect(screen.getByText('✓ Significant')).toBeInTheDocument()
  })

  it('uses danger tone and Violation pill when isViolation', () => {
    render(<MetricCard {...baseProps} isViolation />)
    const card = screen.getByTestId('ui-metric-card')
    expect(card).toHaveAttribute('data-tone', 'danger')
    expect(screen.getByText('⚠ Violation')).toBeInTheDocument()
  })

  it('uses neutral tone and Not significant pill when not significant', () => {
    render(<MetricCard {...baseProps} isSignificant={false} />)
    const card = screen.getByTestId('ui-metric-card')
    expect(card).toHaveAttribute('data-tone', 'neutral')
    expect(screen.getByText('— Not significant')).toBeInTheDocument()
  })

  it('renders relative lift as the display value with sign and %', () => {
    render(<MetricCard {...baseProps} />)
    expect(screen.getByText('+4.8%')).toHaveClass(
      'text-display',
      'leading-display',
      'font-medium',
      'text-success'
    )
  })

  it('colors the lift in danger when isViolation', () => {
    render(<MetricCard {...baseProps} isViolation relativeLift={-0.034} />)
    expect(screen.getByText('-3.4%')).toHaveClass('text-danger')
  })

  it('colors the lift in muted when not significant', () => {
    render(<MetricCard {...baseProps} isSignificant={false} />)
    expect(screen.getByText('+4.8%')).toHaveClass('text-muted')
  })

  it('renders supporting stats inline (control → treatment · p)', () => {
    render(<MetricCard {...baseProps} />)
    expect(screen.getByText('68.2% → 71.5% · p 0.012')).toBeInTheDocument()
  })

  it('formats tiny p-values as <0.001', () => {
    render(<MetricCard {...baseProps} pValue={0.0004} />)
    expect(screen.getByText(/p <0\.001/)).toBeInTheDocument()
  })

  it('renders the CiBar with the given CI bounds', () => {
    render(<MetricCard {...baseProps} />)
    expect(screen.getByTestId('ui-ci-bar')).toBeInTheDocument()
    expect(screen.getByText('95% CI [+1.2pp, +8.4pp]')).toBeInTheDocument()
  })

  it('exposes kind on data-kind', () => {
    render(<MetricCard {...baseProps} kind="guardrail" />)
    expect(screen.getByTestId('ui-metric-card')).toHaveAttribute('data-kind', 'guardrail')
  })
})
