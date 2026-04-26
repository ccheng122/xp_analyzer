import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  subtle?: boolean
  className?: string
}

export function Card({ children, subtle = false, className = '' }: CardProps) {
  const surface = subtle ? 'bg-surface-subtle' : 'bg-surface'
  return (
    <div
      data-testid="ui-card"
      className={`${surface} border border-border rounded-card px-card-x py-card-y ${className}`}
    >
      {children}
    </div>
  )
}
