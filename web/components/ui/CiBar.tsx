export type CiDirection = 'higher-is-better' | 'lower-is-better'

type CiTone = 'success' | 'danger' | 'neutral'

interface CiBarProps {
  lower: number
  upper: number
  isViolation: boolean
  direction: CiDirection
}

function deriveTone(
  lower: number,
  upper: number,
  direction: CiDirection,
  isViolation: boolean
): CiTone {
  if (isViolation) return 'danger'
  const isFavorable = direction === 'higher-is-better' ? lower > 0 : upper < 0
  return isFavorable ? 'success' : 'neutral'
}

function formatPp(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(1)}pp`
}

const FILL_CLASS: Record<CiTone, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  neutral: 'bg-border-strong',
}

export function CiBar({ lower, upper, isViolation, direction }: CiBarProps) {
  const tone = deriveTone(lower, upper, direction, isViolation)

  const range = Math.max(Math.abs(lower), Math.abs(upper), 0.001) * 1.2
  const leftPct = Math.max(0, Math.min(100, ((lower + range) / (2 * range)) * 100))
  const rightPct = Math.max(0, Math.min(100, ((upper + range) / (2 * range)) * 100))
  const widthPct = Math.max(2, rightPct - leftPct)

  const leftLabel = direction === 'higher-is-better' ? '← worse' : '← better'

  return (
    <div data-testid="ui-ci-bar" data-tone={tone}>
      <div className="relative h-ci-bar bg-page rounded-control">
        <div className="absolute left-1/2 top-0 w-px h-full bg-border-strong -translate-x-1/2" />
        <div
          className={`absolute top-0 h-full rounded-control ${FILL_CLASS[tone]}`}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
      </div>
      <div className="flex justify-between text-axis text-faint mt-1">
        <span>{leftLabel}</span>
        <span>0</span>
        <span>95% CI [{formatPp(lower)}, {formatPp(upper)}]</span>
      </div>
    </div>
  )
}
