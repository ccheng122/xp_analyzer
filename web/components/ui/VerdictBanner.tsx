export type VerdictTone = 'neutral' | 'success' | 'danger'

interface VerdictBannerProps {
  title: string
  body: string
  tone?: VerdictTone
}

const BORDER_LEFT_CLASS: Record<VerdictTone, string> = {
  success: 'border-l-success',
  danger: 'border-l-danger',
  neutral: 'border-l-border-strong',
}

export function VerdictBanner({ title, body, tone = 'neutral' }: VerdictBannerProps) {
  return (
    <div
      data-testid="ui-verdict-banner"
      data-tone={tone}
      className={`bg-surface-subtle border border-border border-l-4 ${BORDER_LEFT_CLASS[tone]} rounded-card px-card-x py-card-y`}
    >
      <div className="text-label leading-tight font-medium text-text">{title}</div>
      <div className="text-label leading-body font-regular text-muted mt-1">{body}</div>
    </div>
  )
}
