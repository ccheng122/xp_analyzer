export type DiagnosticStatus = 'pass' | 'flag' | 'fail' | 'not-run'

interface DiagnosticRowProps {
  label: string
  status: DiagnosticStatus
}

const STATUS_META: Record<DiagnosticStatus, { glyph: string; className: string }> = {
  pass: { glyph: '✓', className: 'text-success' },
  flag: { glyph: '⚠', className: 'text-warning' },
  fail: { glyph: '✗', className: 'text-danger' },
  'not-run': { glyph: '—', className: 'text-muted' },
}

export function DiagnosticRow({ label, status }: DiagnosticRowProps) {
  const meta = STATUS_META[status]
  return (
    <div
      data-testid="ui-diagnostic-row"
      data-status={status}
      className="flex justify-between items-center text-body leading-body py-1"
    >
      <span className="text-muted">{label}</span>
      <span className={meta.className} aria-label={status}>
        {meta.glyph}
      </span>
    </div>
  )
}
