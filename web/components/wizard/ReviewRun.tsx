'use client'
import { useState } from 'react'
import type { ExperimentConfig, ExperimentResult, ParsedCsv } from '@/lib/types'
import { downloadYaml } from '@/lib/config-yaml'
import { runAnalysis } from '@/lib/api'

interface Props {
  csv: ParsedCsv
  config: ExperimentConfig
  error: string | null
  onResult: (result: ExperimentResult) => void
  onError: (error: string) => void
}

export function ReviewRun({ csv, config, error, onResult, onError }: Props) {
  const [loading, setLoading] = useState(false)
  const [slow, setSlow] = useState(false)

  async function handleRun() {
    setLoading(true)
    setSlow(false)
    const timer = setTimeout(() => setSlow(true), 3000)
    try {
      const result = await runAnalysis(csv.file, config)
      onResult(result)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      clearTimeout(timer)
      setLoading(false)
      setSlow(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600 leading-relaxed">
        <div className="font-semibold text-slate-800 mb-1">{config.experiment_name}</div>
        <div>Group column: <code className="bg-slate-100 px-1 rounded">{config.group_column}</code> · Control: <code className="bg-slate-100 px-1 rounded">{config.control_group}</code></div>
        <div>{config.metrics.length} metric{config.metrics.length !== 1 ? 's' : ''} · {config.correction_method} · α={config.significance_threshold}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-100 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-indigo-600">{config.metrics.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">metrics</div>
        </div>
        <div className="bg-slate-100 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-indigo-600">{csv.rowCount.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-0.5">rows</div>
        </div>
      </div>

      <button
        className="w-full border border-slate-200 bg-white text-slate-600 rounded-md py-2 text-sm hover:bg-slate-50"
        onClick={() => downloadYaml(config)}
      >
        ⬇ Download config.yaml
      </button>

      <button
        className="w-full bg-indigo-500 text-white rounded-md py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors"
        disabled={loading}
        onClick={handleRun}
      >
        {loading ? '⏳ Running…' : '▶ Run Analysis'}
      </button>

      {slow && (
        <p className="text-xs text-slate-400 text-center">This may take a moment for large files…</p>
      )}
    </div>
  )
}
