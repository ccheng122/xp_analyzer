import type { Decision } from '@/lib/types'

const STYLES: Record<Decision, { bg: string; border: string; text: string; label: string }> = {
  ship: { bg: 'bg-green-50', border: 'border-l-green-500', text: 'text-green-700', label: '✓ SHIP' },
  "don't ship": { bg: 'bg-red-50', border: 'border-l-red-500', text: 'text-red-700', label: '✗ DON\'T SHIP' },
  'review guardrail': { bg: 'bg-orange-50', border: 'border-l-orange-500', text: 'text-orange-700', label: '⚠ REVIEW GUARDRAIL' },
  'needs more data': { bg: 'bg-yellow-50', border: 'border-l-yellow-500', text: 'text-yellow-700', label: '⏳ NEEDS MORE DATA' },
  inconclusive: { bg: 'bg-yellow-50', border: 'border-l-yellow-500', text: 'text-yellow-700', label: '— INCONCLUSIVE' },
}

interface Props {
  decision: Decision
  rationale: string
}

export function RecommendationBanner({ decision, rationale }: Props) {
  const s = STYLES[decision]
  return (
    <div
      data-testid="recommendation-banner"
      className={`${s.bg} border-l-4 ${s.border} rounded-lg px-5 py-4`}
    >
      <div className={`font-bold text-base ${s.text} mb-1`}>{s.label}</div>
      <div className="text-sm text-slate-600">{rationale}</div>
    </div>
  )
}
