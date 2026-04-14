import type { MetricResult } from '@/lib/types'
import { CiBar } from './CiBar'

function formatPct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

function formatLift(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(1)}%`
}

function formatPValue(n: number | null) {
  if (n == null) return '—'
  if (n < 0.001) return '<0.001'
  return n.toFixed(3)
}

interface BadgeInfo { label: string; className: string }

function getBadge(result: MetricResult): BadgeInfo {
  if (!result.is_significant) {
    return { label: '— Not significant', className: 'bg-slate-100 text-slate-500' }
  }
  if (result.metric_role === 'guardrail') {
    const isBadDirection = result.higher_is_better
      ? result.relative_lift < 0
      : result.relative_lift > 0
    if (isBadDirection) {
      return { label: '⚠ Violation', className: 'bg-red-100 text-red-600' }
    }
  }
  return { label: '✓ Significant', className: 'bg-green-100 text-green-700' }
}

function getCardStyle(result: MetricResult) {
  const badge = getBadge(result)
  if (badge.label.includes('Violation')) return 'bg-red-50 border-red-200'
  if (badge.label.includes('Significant')) return 'bg-green-50 border-green-200'
  return 'bg-white border-slate-200'
}

interface Props { result: MetricResult }

export function MetricCard({ result }: Props) {
  const badge = getBadge(result)

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${getCardStyle(result)}`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-sm text-slate-800">{result.metric_name}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {result.metric_role} · {result.metric_type} · {result.higher_is_better ? 'higher is better' : 'lower is better'}
          </div>
        </div>
        <span className={`text-xs rounded px-2 py-0.5 font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div>
          <div className="text-xs text-slate-500 mb-0.5">Control</div>
          <div className="font-bold text-slate-800">{formatPct(result.control_mean)}</div>
          <div className="text-xs text-slate-400">n={result.control_n.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-0.5">Treatment</div>
          <div className="font-bold text-slate-800">{formatPct(result.treatment_mean)}</div>
          <div className="text-xs text-slate-400">n={result.treatment_n.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-0.5">Relative Lift</div>
          <div className={`font-bold ${result.relative_lift >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatLift(result.relative_lift)}
          </div>
          <div className="text-xs text-slate-400">abs {formatLift(result.absolute_lift)}pp</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-0.5">p-value</div>
          <div className="font-bold text-slate-800">{formatPValue(result.p_value_corrected ?? result.p_value)}</div>
          <div className="text-xs text-slate-400">
            {result.p_value_corrected != null ? 'corrected' : 'raw'}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500 mb-1">
          95% CI (absolute): [{formatLift(result.confidence_interval_low)}pp, {formatLift(result.confidence_interval_high)}pp]
        </div>
        <CiBar
          low={result.confidence_interval_low}
          high={result.confidence_interval_high}
          higherIsBetter={result.higher_is_better}
        />
      </div>
    </div>
  )
}
