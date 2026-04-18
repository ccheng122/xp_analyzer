import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportView } from '../report/ReportView'
import type { ExperimentResult } from '@/lib/types'

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    input: '',
    sendMessage: vi.fn(),
    status: 'ready',
    error: undefined,
  })),
}))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    DefaultChatTransport: vi.fn().mockImplementation(() => ({})),
  }
})

const result: ExperimentResult = {
  experiment_name: 'Test Exp',
  control_group: '0',
  treatment_groups: ['1'],
  total_users: 30000,
  metric_results: [
    {
      metric_name: 'conversion',
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
    },
  ],
  findings: [
    { metric_name: 'conversion', metric_role: 'primary', is_significant: true, direction: 'positive', summary: 'conversion improved.' },
  ],
  recommendation: {
    decision: 'ship',
    rationale: 'Primary metric improved significantly.',
    caveats: ['Check retention.'],
  },
}

describe('ReportView', () => {
  it('renders recommendation', () => {
    render(<ReportView result={result} onRunAnother={vi.fn()} />)
    expect(screen.getByText(/ship/i)).toBeInTheDocument()
  })

  it('renders metric card', () => {
    render(<ReportView result={result} onRunAnother={vi.fn()} />)
    expect(screen.getByText('conversion')).toBeInTheDocument()
  })

  it('renders caveats when present', () => {
    render(<ReportView result={result} onRunAnother={vi.fn()} />)
    expect(screen.getByText('Check retention.')).toBeInTheDocument()
  })

  it('does not render caveats block when caveats is empty', () => {
    const noCaveats = {
      ...result,
      recommendation: { ...result.recommendation, caveats: [] },
    }
    render(<ReportView result={noCaveats} onRunAnother={vi.fn()} />)
    expect(screen.queryByTestId('caveats-block')).not.toBeInTheDocument()
  })

  it('calls onRunAnother when button clicked', async () => {
    const onRunAnother = vi.fn()
    render(<ReportView result={result} onRunAnother={onRunAnother} />)
    await userEvent.click(screen.getByRole('button', { name: /run another/i }))
    expect(onRunAnother).toHaveBeenCalledOnce()
  })
})
