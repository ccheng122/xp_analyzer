import type { ExperimentConfig, ExperimentResult } from '@/lib/types'
import { RecommendationBanner } from './RecommendationBanner'
import { StatsBar } from './StatsBar'
import { MetricCard } from './MetricCard'
import { CaveatsBlock } from './CaveatsBlock'
import { ChatPanel } from './ChatPanel'

interface Props {
  result: ExperimentResult
  config?: ExperimentConfig
  csvFile?: File
  onRunAnother: () => void
}

export function ReportView({ result, config, csvFile, onRunAnother }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <RecommendationBanner
        decision={result.recommendation.decision}
        rationale={result.recommendation.rationale}
      />

      {config && (
        <StatsBar
          totalUsers={result.total_users}
          metricCount={result.metric_results.length}
          significanceThreshold={config.significance_threshold}
          correctionMethod={config.correction_method}
        />
      )}

      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Metric Results
        </div>
        <div className="flex flex-col gap-3">
          {result.metric_results.map(r => (
            <MetricCard key={r.metric_name} result={r} />
          ))}
        </div>
      </div>

      <CaveatsBlock caveats={result.recommendation.caveats} />

      <div className="flex gap-3 pt-2">
        <button
          className="flex-1 border border-slate-200 bg-white text-slate-600 rounded-md py-2 text-sm hover:bg-slate-50"
          onClick={() => {
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${result.experiment_name.replace(/\s+/g, '_')}_result.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }}
        >
          ⬇ Download JSON
        </button>
        <button
          className="flex-1 border border-slate-200 bg-white text-slate-600 rounded-md py-2 text-sm hover:bg-slate-50"
          onClick={onRunAnother}
        >
          ← Run Another
        </button>
      </div>

      {csvFile && <ChatPanel result={result} csvFile={csvFile} config={config} />}
    </div>
  )
}
