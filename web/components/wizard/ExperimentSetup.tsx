'use client'
import { useEffect, useState } from 'react'
import type { ExperimentConfig } from '@/lib/types'
import { getUniqueColumnValues } from '@/lib/csv'

interface Props {
  headers: string[]
  csvFile: File
  config: Partial<ExperimentConfig>
  onUpdate: (patch: Partial<ExperimentConfig>) => void
  onContinue: () => void
}

export function ExperimentSetup({ headers, csvFile, config, onUpdate, onContinue }: Props) {
  const [groupValues, setGroupValues] = useState<string[]>([])
  const [loadingValues, setLoadingValues] = useState(false)
  const [valuesError, setValuesError] = useState<string | null>(null)

  useEffect(() => {
    if (config.group_column) {
      setLoadingValues(true)
      setValuesError(null)
      getUniqueColumnValues(csvFile, config.group_column)
        .then(vals => { setGroupValues(vals); setLoadingValues(false) })
        .catch(e => { setValuesError(e.message); setGroupValues([]); setLoadingValues(false) })
    }
  }, [csvFile, config.group_column])

  const isValid = !!(config.experiment_name?.trim() && config.group_column && config.control_group)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
          Experiment Name
        </label>
        <input
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={config.experiment_name ?? ''}
          onChange={e => onUpdate({ experiment_name: e.target.value })}
          placeholder="e.g. Free to Plus Upgrade"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
          Group Column
        </label>
        <select
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={config.group_column ?? ''}
          onChange={e => {
            onUpdate({ group_column: e.target.value, control_group: undefined })
            setGroupValues([])
          }}
        >
          <option value="">— select column —</option>
          {headers.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
          Control Group Value
        </label>
        <select
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={config.control_group ?? ''}
          onChange={e => onUpdate({ control_group: e.target.value })}
          disabled={!config.group_column || loadingValues}
        >
          <option value="">{loadingValues ? '⏳ Loading…' : '— select value —'}</option>
          {groupValues.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        {valuesError && <p className="text-xs text-red-500 mt-1">{valuesError}</p>}
      </div>

      <button
        className="w-full bg-indigo-500 text-white rounded-md py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors"
        disabled={!isValid}
        onClick={onContinue}
      >
        Continue →
      </button>
    </div>
  )
}
