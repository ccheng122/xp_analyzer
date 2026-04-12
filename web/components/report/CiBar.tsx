interface Props {
  low: number
  high: number
  higherIsBetter: boolean
}

export function CiBar({ low, high, higherIsBetter }: Props) {
  const isPositive = high > 0 && low >= 0
  const isNegative = low < 0 && high <= 0
  const color = higherIsBetter
    ? isPositive ? 'bg-green-500' : isNegative ? 'bg-red-500' : 'bg-slate-400'
    : isNegative ? 'bg-green-500' : isPositive ? 'bg-red-500' : 'bg-slate-400'

  const range = 0.05
  const leftPct = Math.max(0, Math.min(100, ((low + range) / (2 * range)) * 100))
  const rightPct = Math.max(0, Math.min(100, ((high + range) / (2 * range)) * 100))
  const widthPct = Math.max(2, rightPct - leftPct)

  return (
    <div>
      <div className="relative h-1.5 bg-slate-200 rounded-full">
        <div className="absolute left-1/2 top-0 w-0.5 h-full bg-slate-400" />
        <div
          className={`absolute top-0 h-full rounded-full ${color}`}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-0.5">
        <span>{higherIsBetter ? '← worse' : '← better'}</span>
        <span>0</span>
        <span>{higherIsBetter ? 'better →' : 'worse →'}</span>
      </div>
    </div>
  )
}
