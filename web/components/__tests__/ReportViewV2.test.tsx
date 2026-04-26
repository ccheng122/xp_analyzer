import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReportViewV2 } from '../report/ReportViewV2'
import type { ExperimentConfig, ExperimentResult } from '@/lib/types'

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: vi.fn(),
    status: 'ready',
    error: undefined,
  })),
}))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    DefaultChatTransport: vi.fn().mockImplementation(function () {
      return {}
    }),
  }
})

const result: ExperimentResult = {
  experiment_name: 'Onboarding redesign',
  control_group: 'control',
  treatment_groups: ['treatment'],
  total_users: 24500,
  metric_results: [
    {
      metric_name: 'Conversion rate',
      metric_type: 'binary',
      metric_role: 'primary',
      higher_is_better: true,
      control_mean: 0.682,
      treatment_mean: 0.715,
      relative_lift: 0.048,
      absolute_lift: 0.033,
      p_value: 0.012,
      p_value_corrected: 0.024,
      confidence_interval_low: 0.012,
      confidence_interval_high: 0.084,
      effect_size: 0.07,
      is_significant: true,
      control_n: 12200,
      treatment_n: 12300,
    },
    {
      metric_name: 'Bounce rate',
      metric_type: 'binary',
      metric_role: 'guardrail',
      higher_is_better: false,
      control_mean: 0.31,
      treatment_mean: 0.305,
      relative_lift: -0.016,
      absolute_lift: -0.005,
      p_value: 0.45,
      p_value_corrected: null,
      confidence_interval_low: -0.02,
      confidence_interval_high: 0.01,
      effect_size: 0.01,
      is_significant: false,
      control_n: 12200,
      treatment_n: 12300,
    },
  ],
  findings: [],
  recommendation: {
    decision: 'ship',
    rationale: 'Primary metric improved significantly with no guardrail violations.',
    caveats: [],
  },
}

const config: ExperimentConfig = {
  experiment_name: 'Onboarding redesign',
  group_column: 'variant',
  control_group: 'control',
  metrics: [],
  significance_threshold: 0.05,
  correction_method: 'bonferroni',
}

const csvFile = new File(['user_id,variant\n1,control'], 'data.csv', { type: 'text/csv' })

describe('ReportViewV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the experiment name and metadata in the header', () => {
    render(
      <ReportViewV2
        result={result}
        config={config}
        csvFile={csvFile}
        onRunAnother={() => {}}
      />
    )
    expect(screen.getByText('Onboarding redesign')).toBeInTheDocument()
    expect(screen.getByText(/24,500 users · 2 metrics · α=0\.05 · bonferroni/)).toBeInTheDocument()
  })

  it('renders the verdict banner with the decision tone and rationale', () => {
    render(
      <ReportViewV2 result={result} csvFile={csvFile} onRunAnother={() => {}} />
    )
    const banner = screen.getByTestId('ui-verdict-banner')
    expect(banner).toHaveAttribute('data-tone', 'success')
    expect(screen.getByText('Ship')).toBeInTheDocument()
    expect(
      screen.getByText('Primary metric improved significantly with no guardrail violations.')
    ).toBeInTheDocument()
  })

  it('renders both columns of the grid with the spec grid-template-columns', () => {
    render(
      <ReportViewV2 result={result} csvFile={csvFile} onRunAnother={() => {}} />
    )
    const grid = screen.getByTestId('report-grid')
    expect(grid).toHaveClass('grid')
    expect(grid).toHaveStyle({ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)' })
    expect(screen.getByTestId('report-left')).toBeInTheDocument()
    expect(screen.getByTestId('report-right')).toBeInTheDocument()
  })

  it('renders one MetricCard per metric in the left column', () => {
    render(
      <ReportViewV2 result={result} csvFile={csvFile} onRunAnother={() => {}} />
    )
    const cards = screen.getAllByTestId('ui-metric-card')
    expect(cards).toHaveLength(2)
    expect(screen.getByText('Conversion rate')).toBeInTheDocument()
    expect(screen.getByText('Bounce rate')).toBeInTheDocument()
  })

  it('renders the diagnostics card with four hardcoded rows', () => {
    render(
      <ReportViewV2 result={result} csvFile={csvFile} onRunAnother={() => {}} />
    )
    const rows = screen.getAllByTestId('ui-diagnostic-row')
    expect(rows).toHaveLength(4)
    expect(screen.getByText('Sample ratio (SRM)')).toBeInTheDocument()
    expect(screen.getByText('Day-of-week balance')).toBeInTheDocument()
  })

  it('renders the chat panel header, suggested chips, input, and Send button', () => {
    render(
      <ReportViewV2 result={result} csvFile={csvFile} onRunAnother={() => {}} />
    )
    expect(screen.getByText('Ask about these results')).toBeInTheDocument()
    expect(screen.getAllByTestId('ui-suggested-chip').length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText(/ask about these results/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('marks a guardrail metric with bad direction as a violation', () => {
    const violationResult: ExperimentResult = {
      ...result,
      metric_results: [
        {
          ...result.metric_results[1],
          metric_role: 'guardrail',
          higher_is_better: false,
          is_significant: true,
          relative_lift: 0.04,
        },
      ],
    }
    render(
      <ReportViewV2
        result={violationResult}
        csvFile={csvFile}
        onRunAnother={() => {}}
      />
    )
    const card = screen.getByTestId('ui-metric-card')
    expect(card).toHaveAttribute('data-tone', 'danger')
  })
})
