import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddMetrics } from '../wizard/AddMetrics'
import type { MetricConfig } from '@/lib/types'

const headers = ['converted', 'canceled']

const primaryMetric: MetricConfig = {
  name: 'conversion',
  column: 'converted',
  type: 'binary',
  role: 'primary',
  higher_is_better: true,
}

describe('AddMetrics', () => {
  it('Continue is disabled when no primary metric is added', () => {
    render(
      <AddMetrics headers={headers} metrics={[]} onUpdate={vi.fn()} onContinue={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('Continue is enabled when at least one primary metric exists', () => {
    render(
      <AddMetrics
        headers={headers}
        metrics={[primaryMetric]}
        onUpdate={vi.fn()}
        onContinue={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  it('shows existing metrics in the list', () => {
    render(
      <AddMetrics
        headers={headers}
        metrics={[primaryMetric]}
        onUpdate={vi.fn()}
        onContinue={vi.fn()}
      />
    )
    expect(screen.getByText('conversion')).toBeInTheDocument()
  })

  it('removing a metric calls onUpdate without it', async () => {
    const onUpdate = vi.fn()
    render(
      <AddMetrics
        headers={headers}
        metrics={[primaryMetric]}
        onUpdate={onUpdate}
        onContinue={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /remove/i }))
    expect(onUpdate).toHaveBeenCalledWith([])
  })
})
