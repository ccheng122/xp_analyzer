import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewRun } from '../wizard/ReviewRun'
import type { ExperimentConfig, ParsedCsv } from '@/lib/types'
import * as apiLib from '@/lib/api'

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

  it('calls onResult when run succeeds', async () => {
    const mockResult = {
      experiment_name: 'Test',
      control_group: '0',
      treatment_groups: ['1'],
      total_users: 1000,
      metric_results: [],
      findings: [],
      recommendation: { decision: 'ship' as const, rationale: 'ok', caveats: [] },
    }
    vi.spyOn(apiLib, 'runAnalysis').mockResolvedValueOnce(mockResult)

    const onResult = vi.fn()
    render(
      <ReviewRun csv={csv} config={config} error={null} onResult={onResult} onError={vi.fn()} />
    )
    await userEvent.click(screen.getByRole('button', { name: /run analysis/i }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(mockResult))
  })

  it('calls onError when run fails', async () => {
    vi.spyOn(apiLib, 'runAnalysis').mockRejectedValueOnce(new Error('Column not found'))

    const onError = vi.fn()
    render(
      <ReviewRun csv={csv} config={config} error={null} onResult={vi.fn()} onError={onError} />
    )
    await userEvent.click(screen.getByRole('button', { name: /run analysis/i }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Column not found'))
  })
})
