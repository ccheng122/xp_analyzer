import type { ExperimentConfig, ExperimentResult, MetricResult } from '@/lib/types'
import realResultJson from './free-plus-result.json'

const realResult = realResultJson as unknown as ExperimentResult

function mutateMetric(m: MetricResult, patch: Partial<MetricResult>): MetricResult {
  return { ...m, ...patch }
}

const ship: ExperimentResult = {
  ...realResult,
  metric_results: realResult.metric_results.map((m) =>
    m.metric_role === 'guardrail'
      ? mutateMetric(m, {
          treatment_mean: m.control_mean,
          relative_lift: -0.004,
          absolute_lift: -0.0002,
          p_value: 0.42,
          p_value_corrected: 0.42,
          confidence_interval_low: -0.012,
          confidence_interval_high: 0.008,
          is_significant: false,
        })
      : m
  ),
  recommendation: {
    decision: 'ship',
    rationale: 'Primary metric improved significantly, no guardrail concerns.',
    caveats: [],
  },
}

const inconclusive: ExperimentResult = {
  ...realResult,
  metric_results: realResult.metric_results.map((m) =>
    mutateMetric(m, {
      relative_lift: m.relative_lift * 0.1,
      absolute_lift: m.absolute_lift * 0.1,
      p_value: 0.38,
      p_value_corrected: 0.76,
      confidence_interval_low: m.confidence_interval_low - 0.008,
      confidence_interval_high: m.confidence_interval_high + 0.004,
      is_significant: false,
    })
  ),
  recommendation: {
    decision: 'inconclusive',
    rationale: 'Neither metric moved enough to draw a conclusion at this sample size.',
    caveats: [],
  },
}

export const FIXTURES: Record<string, ExperimentResult> = {
  'real → review guardrail': realResult,
  'mutated → ship': ship,
  'mutated → inconclusive': inconclusive,
}

export const mockConfig: ExperimentConfig = {
  experiment_name: realResult.experiment_name,
  group_column: 'treatment',
  control_group: realResult.control_group,
  metrics: [],
  significance_threshold: 0.05,
  correction_method: 'bonferroni',
}
