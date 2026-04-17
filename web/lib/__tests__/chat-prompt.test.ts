import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/app/api/chat/route'
import type { ExperimentResult } from '@/lib/types'

const result: ExperimentResult = {
  experiment_name: 'Free to Plus',
  control_group: '0',
  treatment_groups: ['1'],
  total_users: 30000,
  metric_results: [
    {
      metric_name: 'paid_conversion',
      metric_type: 'binary',
      metric_role: 'primary',
      higher_is_better: true,
      control_mean: 0.0796,
      treatment_mean: 0.0966,
      relative_lift: 0.2136,
      absolute_lift: 0.017,
      p_value: 0.0000007,
      p_value_corrected: 0.0000007,
      confidence_interval_low: 0.010,
      confidence_interval_high: 0.024,
      effect_size: 1.21,
      is_significant: true,
      control_n: 20000,
      treatment_n: 10000,
    },
  ],
  findings: [
    {
      metric_name: 'paid_conversion',
      metric_role: 'primary',
      is_significant: true,
      direction: 'positive',
      summary: 'paid_conversion improved by +21.4%',
    },
  ],
  recommendation: {
    decision: 'ship',
    rationale: 'All primary metrics improved.',
    caveats: ['Monitor post-launch.'],
  },
}

describe('buildSystemPrompt', () => {
  it('includes experiment name', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('Free to Plus')
  })

  it('includes control and treatment groups', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('control_group: 0')
    expect(prompt).toContain('treatment_groups: 1')
  })

  it('includes metric name and role', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('paid_conversion')
    expect(prompt).toContain('primary')
  })

  it('includes recommendation decision', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('ship')
  })

  it('includes guideline about missing data', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain("wasn't in your CSV")
  })

  it('formats binary metric means as percentages', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('7.96%')
    expect(prompt).toContain('9.66%')
  })

  it('formats continuous metric means as raw numbers', () => {
    const continuousResult: ExperimentResult = {
      ...result,
      metric_results: [{
        ...result.metric_results[0],
        metric_name: 'revenue',
        metric_type: 'continuous',
        control_mean: 42.5678,
        treatment_mean: 45.1234,
      }],
    }
    const prompt = buildSystemPrompt(continuousResult)
    expect(prompt).toContain('42.5678')
    expect(prompt).toContain('45.1234')
  })

  it('includes sample sizes in prompt', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('20,000')
    expect(prompt).toContain('10,000')
  })

  it('includes confidence interval in prompt', () => {
    const prompt = buildSystemPrompt(result)
    expect(prompt).toContain('CI=[')
  })
})
