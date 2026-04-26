import { describe, it, expect } from 'vitest'
import { setExperiment, getExperiment, type StoredExperiment } from '../experimentStore'
import type { ExperimentConfig, ExperimentResult } from '../types'

const result: ExperimentResult = {
  experiment_name: 'X',
  control_group: '0',
  treatment_groups: ['1'],
  total_users: 100,
  metric_results: [],
  findings: [],
  recommendation: { decision: 'ship', rationale: 'r', caveats: [] },
}

const config: ExperimentConfig = {
  experiment_name: 'X',
  group_column: 'variant',
  control_group: '0',
  metrics: [],
  significance_threshold: 0.05,
  correction_method: 'bonferroni',
}

const csvFile = new File(['variant,converted\n0,1'], 'data.csv', { type: 'text/csv' })

describe('experimentStore', () => {
  it('round-trips an experiment by id', () => {
    const id = 'test-id-1'
    const stored: StoredExperiment = { result, config, csvFile }
    setExperiment(id, stored)
    expect(getExperiment(id)).toBe(stored)
  })

  it('returns undefined for an unknown id', () => {
    expect(getExperiment('nonexistent-' + Math.random())).toBeUndefined()
  })

  it('preserves the live File reference (cannot be JSON-serialized)', () => {
    const id = 'test-id-2'
    setExperiment(id, { result, config, csvFile })
    expect(getExperiment(id)?.csvFile).toBe(csvFile)
  })

  it('overwrites a previous value at the same id', () => {
    const id = 'test-id-3'
    setExperiment(id, { result, config, csvFile })
    const otherFile = new File(['x'], 'other.csv')
    setExperiment(id, { result, config, csvFile: otherFile })
    expect(getExperiment(id)?.csvFile).toBe(otherFile)
  })
})
