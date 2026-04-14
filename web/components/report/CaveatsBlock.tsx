interface Props { caveats: string[] }

export function CaveatsBlock({ caveats }: Props) {
  if (caveats.length === 0) return null
  return (
    <div data-testid="caveats-block" className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg px-4 py-3">
      <div className="text-xs font-bold text-yellow-700 mb-1">⚠ Caveats</div>
      <ul className="list-disc list-inside text-sm text-yellow-800 space-y-0.5">
        {caveats.map((c, i) => <li key={i}>{c}</li>)}
      </ul>
    </div>
  )
}
