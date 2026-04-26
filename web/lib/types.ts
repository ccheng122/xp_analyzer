export type MetricType = 'continuous' | 'binary'
export type MetricRole = 'primary' | 'guardrail' | 'secondary'
export type Decision =
  | 'ship'
  | "don't ship"
  | 'needs more data'
  | 'inconclusive'
  | 'review guardrail'

export interface FilterBy {
  column: string
  condition: 'not_null'
}

export interface MetricConfig {
  name: string
  column: string
  type: MetricType
  role: MetricRole
  higher_is_better: boolean
  derive?: 'not_null' | null
  filter_by?: FilterBy | null
}

export interface ExperimentConfig {
  experiment_name: string
  group_column: string
  control_group: string
  metrics: MetricConfig[]
  significance_threshold: number
  correction_method: 'bonferroni' | 'benjamini-hochberg'
}

export interface MetricResult {
  metric_name: string
  metric_type: MetricType
  metric_role: MetricRole
  higher_is_better: boolean
  control_mean: number
  treatment_mean: number
  relative_lift: number
  absolute_lift: number
  p_value: number
  p_value_corrected: number | null
  confidence_interval_low: number
  confidence_interval_high: number
  effect_size: number
  is_significant: boolean
  control_n: number
  treatment_n: number
}

export interface Finding {
  metric_name: string
  metric_role: MetricRole
  is_significant: boolean
  direction: 'positive' | 'negative' | 'neutral'
  summary: string
}

export interface Recommendation {
  decision: Decision
  rationale: string
  caveats: string[]
}

export interface ExperimentResult {
  experiment_name: string
  control_group: string
  treatment_groups: string[]
  total_users: number
  metric_results: MetricResult[]
  findings: Finding[]
  recommendation: Recommendation
}

// Wizard state held at top level
export interface ParsedCsv {
  headers: string[]
  rowCount: number
  file: File
}

export interface WizardState {
  step: 1 | 2 | 3 | 4
  csv: ParsedCsv | null
  config: Partial<ExperimentConfig>
  error: string | null
}
