import { describe, it, expect } from 'vitest'
import { configToYaml } from '../config-yaml'
import type { ExperimentConfig } from '../types'

const config: ExperimentConfig = {
  experiment_name: 'Free to Plus',
  group_column: 'variant',
  control_group: '0',
  significance_threshold: 0.05,
  correction_method: 'bonferroni',
  metrics: [
    {
      name: 'paid_conversion',
      column: 'converted',
      type: 'binary',
      role: 'primary',
      higher_is_better: true,
    },
    {
      name: 'canceled',
      column: 'plan_canceled',
      type: 'binary',
      role: 'guardrail',
      higher_is_better: false,
      filter_by: { column: 'has_subscription', condition: 'not_null' },
    },
  ],
}

describe('configToYaml', () => {
  it('includes all top-level fields', () => {
    const yaml = configToYaml(config)
    expect(yaml).toContain('experiment_name: "Free to Plus"')
    expect(yaml).toContain('group_column: "variant"')
    expect(yaml).toContain('control_group: "0"')
    expect(yaml).toContain('significance_threshold: 0.05')
    expect(yaml).toContain('correction_method: bonferroni')
  })

  it('includes metric fields', () => {
    const yaml = configToYaml(config)
    expect(yaml).toContain('name: "paid_conversion"')
    expect(yaml).toContain('role: primary')
    expect(yaml).toContain('higher_is_better: true')
  })

  it('includes filter_by when present', () => {
    const yaml = configToYaml(config)
    expect(yaml).toContain('filter_by:')
    expect(yaml).toContain('column: "has_subscription"')
    expect(yaml).toContain('condition: not_null')
  })

  it('omits filter_by when absent', () => {
    const simpleConfig = { ...config, metrics: [config.metrics[0]] }
    const yaml = configToYaml(simpleConfig)
    expect(yaml).not.toContain('filter_by')
  })
})
