import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCard } from '../report/MetricCard'
import type { MetricResult } from '@/lib/types'

const significantResult: MetricResult = {
  metric_name: 'paid_conversion',
  metric_type: 'binary',
  metric_role: 'primary',
  higher_is_better: true,
  control_mean: 0.08,
  treatment_mean: 0.097,
  relative_lift: 0.214,
  absolute_lift: 0.017,
  p_value: 0.0001,
  p_value_corrected: 0.0002,
  confidence_interval_low: 0.01,
  confidence_interval_high: 0.024,
  effect_size: 0.12,
  is_significant: true,
  control_n: 20000,
  treatment_n: 10000,
}

const guardrailViolation: MetricResult = {
  ...significantResult,
  metric_name: 'plan_canceled',
  metric_role: 'guardrail',
  higher_is_better: false,
  relative_lift: 0.225,
}

describe('MetricCard', () => {
  it('shows Significant badge for significant primary metric', () => {
    render(<MetricCard result={significantResult} />)
    expect(screen.getByText(/significant/i)).toBeInTheDocument()
  })

  it('shows Violation badge for significant guardrail with bad direction', () => {
    render(<MetricCard result={guardrailViolation} />)
    expect(screen.getByText(/violation/i)).toBeInTheDocument()
  })

  it('shows control and treatment means', () => {
    render(<MetricCard result={significantResult} />)
    expect(screen.getByText('8.0%')).toBeInTheDocument()
    expect(screen.getByText('9.7%')).toBeInTheDocument()
  })

  it('shows relative lift', () => {
    render(<MetricCard result={significantResult} />)
    expect(screen.getByText('+21.4%')).toBeInTheDocument()
  })
})
