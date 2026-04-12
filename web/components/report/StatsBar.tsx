interface Props {
  totalUsers: number
  metricCount: number
  significanceThreshold: number
  correctionMethod: string
}

export function StatsBar({ totalUsers, metricCount, significanceThreshold, correctionMethod }: Props) {
  return (
    <div className="flex gap-3">
      {[
        { value: totalUsers.toLocaleString(), label: 'Total Users' },
        { value: metricCount.toString(), label: 'Metrics' },
        { value: `α=${significanceThreshold} · ${correctionMethod}`, label: 'Correction' },
      ].map(({ value, label }) => (
        <div key={label} className="flex-1 bg-slate-100 rounded-lg p-3 text-center">
          <div className="font-bold text-slate-800 text-lg">{value}</div>
          <div className="text-xs text-slate-500 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  )
}
