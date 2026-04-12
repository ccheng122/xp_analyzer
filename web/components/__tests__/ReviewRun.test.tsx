import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewRun } from '../wizard/ReviewRun'
import type { ExperimentConfig, ParsedCsv } from '@/lib/types'

const csv: ParsedCsv = {
  headers: ['variant', 'converted'],
  rowCount: 1000,
  file: new File(['variant,converted\n0,1\n'], 'data.csv'),
}

const config: ExperimentConfig = {
  experiment_name: 'Test Exp',
  group_column: 'variant',
  control_group: '0',
  significance_threshold: 0.05,
  correction_method: 'bonferroni',
  metrics: [
    { name: 'conv', column: 'converted', type: 'binary', role: 'primary', higher_is_better: true },
  ],
}

describe('ReviewRun', () => {
  it('shows config summary', () => {
    render(
      <ReviewRun csv={csv} config={config} error={null} onResult={vi.fn()} onError={vi.fn()} />
    )
    expect(screen.getByText('Test Exp')).toBeInTheDocument()
    expect(screen.getByText(/bonferroni/i)).toBeInTheDocument()
  })

  it('shows error banner when error is set', () => {
    render(
      <ReviewRun
        csv={csv}
        config={config}
        error="Column not found"
        onResult={vi.fn()}
        onError={vi.fn()}
      />
    )
    expect(screen.getByText('Column not found')).toBeInTheDocument()
  })
})
