interface SuggestedChipProps {
  label: string
  onClick: () => void
}

export function SuggestedChip({ label, onClick }: SuggestedChipProps) {
  return (
    <button
      type="button"
      data-testid="ui-suggested-chip"
      onClick={onClick}
      className="inline-flex items-center bg-surface-subtle text-text text-meta leading-tight rounded-pill px-3 py-1 hover:bg-border transition-colors cursor-pointer"
    >
      {label}
    </button>
  )
}
