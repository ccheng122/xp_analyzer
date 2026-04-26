import type { ReactNode } from 'react'

export type PillVariant = 'success' | 'danger' | 'neutral'

interface PillProps {
  variant?: PillVariant
  children: ReactNode
}

const VARIANT_CLASS: Record<PillVariant, string> = {
  success: 'bg-success-bg text-success-fg',
  danger: 'bg-danger-bg text-danger-fg',
  neutral: 'bg-surface-subtle text-muted',
}

export function Pill({ variant = 'neutral', children }: PillProps) {
  return (
    <span
      data-testid="ui-pill"
      data-variant={variant}
      className={`inline-flex items-center text-meta leading-tight font-medium rounded-pill px-2 py-0.5 ${VARIANT_CLASS[variant]}`}
    >
      {children}
    </span>
  )
}
