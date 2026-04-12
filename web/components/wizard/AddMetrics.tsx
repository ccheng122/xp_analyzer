'use client'
import { useState } from 'react'
import type { MetricConfig } from '@/lib/types'
import { MetricForm } from './MetricForm'

const ROLE_COLORS: Record<string, string> = {
  primary: 'bg-green-100 text-green-700',
  guardrail: 'bg-red-100 text-red-600',
  secondary: 'bg-slate-100 text-slate-600',
}

interface Props {
  headers: string[]
  metrics: MetricConfig[]
  onUpdate: (metrics: MetricConfig[]) => void
  onContinue: () => void
}

export function AddMetrics({ headers, metrics, onUpdate, onContinue }: Props) {
  const [showForm, setShowForm] = useState(false)
  const hasPrimary = metrics.some(m => m.role === 'primary')

  function handleAdd(metric: MetricConfig) {
    onUpdate([...metrics, metric])
    setShowForm(false)
  }

  function handleRemove(index: number) {
    onUpdate(metrics.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-4">
      {metrics.length > 0 && (
        <div className="flex flex-col gap-2">
          {metrics.map((m, i) => (
            <div key={m.name} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-700 text-sm">{m.name}</span>
                <span className={`text-xs rounded px-2 py-0.5 font-medium ${ROLE_COLORS[m.role]}`}>
                  {m.role}
                </span>
                <span className="text-xs text-slate-400">{m.type}</span>
              </div>
              <button
                aria-label="Remove"
                className="text-xs text-red-400 hover:text-red-600"
                onClick={() => handleRemove(i)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <button
          className="border border-dashed border-slate-300 rounded-lg py-3 text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
          onClick={() => setShowForm(true)}
        >
          + Add Metric
        </button>
      ) : (
        <MetricForm
          headers={headers}
          onAdd={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {!hasPrimary && (
        <p className="text-xs text-amber-600">At least one primary metric is required.</p>
      )}

      <button
        className="w-full bg-indigo-500 text-white rounded-md py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors"
        disabled={!hasPrimary}
        onClick={onContinue}
      >
        Continue →
      </button>
    </div>
  )
}
