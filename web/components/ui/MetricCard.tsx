import { Card } from './Card'
import { Pill, type PillVariant } from './Pill'
import { CiBar, type CiDirection } from './CiBar'

export type MetricKind = 'primary' | 'guardrail'

interface MetricCardProps {
  name: string
  kind: MetricKind
  description: string
  controlRate: number
  treatmentRate: number
  relativeLift: number
  pValue: number
  ciLower: number
  ciUpper: number
  direction: CiDirection
  isSignificant: boolean
  isViolation: boolean
}

type MetricTone = 'success' | 'danger' | 'neutral'

function deriveTone(isSignificant: boolean, isViolation: boolean): MetricTone {
  if (isViolation) return 'danger'
  if (isSignificant) return 'success'
  return 'neutral'
}

function statusLabel(isSignificant: boolean, isViolation: boolean): string {
  if (isViolation) return '⚠ Violation'
  if (isSignificant) return '✓ Significant'
  return '— Not significant'
}

const VALUE_TONE_CLASS: Record<MetricTone, string> = {
  success: 'text-success',
  danger: 'text-danger',
  neutral: 'text-muted',
}

const TONE_TO_VARIANT: Record<MetricTone, PillVariant> = {
  success: 'success',
  danger: 'danger',
  neutral: 'neutral',
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function formatLift(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(1)}%`
}

function formatPValue(n: number): string {
  if (n < 0.001) return '<0.001'
  return n.toFixed(3)
}

export function MetricCard({
  name,
  kind,
  description,
  controlRate,
  treatmentRate,
  relativeLift,
  pValue,
  ciLower,
  ciUpper,
  direction,
  isSignificant,
  isViolation,
}: MetricCardProps) {
  const tone = deriveTone(isSignificant, isViolation)
  const valueClass = VALUE_TONE_CLASS[tone]
  const pillVariant = TONE_TO_VARIANT[tone]
  const status = statusLabel(isSignificant, isViolation)

  return (
    <Card>
      <div
        data-testid="ui-metric-card"
        data-tone={tone}
        data-kind={kind}
        className="flex flex-col gap-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-section leading-tight font-medium text-text">{name}</div>
            <div className="text-meta leading-tight text-muted mt-0.5">
              {kind} · {description}
            </div>
          </div>
          <Pill variant={pillVariant}>{status}</Pill>
        </div>

        <div className="flex items-baseline gap-3 flex-wrap">
          <div className={`text-display leading-display font-medium ${valueClass}`}>
            {formatLift(relativeLift)}
          </div>
          <div className="text-meta leading-tight text-muted">
            {formatPct(controlRate)} → {formatPct(treatmentRate)} · p {formatPValue(pValue)}
          </div>
        </div>

        <CiBar
          lower={ciLower}
          upper={ciUpper}
          direction={direction}
          isViolation={isViolation}
        />
      </div>
    </Card>
  )
}
