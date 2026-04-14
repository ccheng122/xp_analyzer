'use client'
import { useState } from 'react'
import type { MetricConfig, MetricType, MetricRole } from '@/lib/types'

interface Props {
  headers: string[]
  onAdd: (metric: MetricConfig) => void
  onCancel: () => void
}

export function MetricForm({ headers, onAdd, onCancel }: Props) {
  const [name, setName] = useState('')
  const [column, setColumn] = useState('')
  const [type, setType] = useState<MetricType>('binary')
  const [role, setRole] = useState<MetricRole>('primary')
  const [higherIsBetter, setHigherIsBetter] = useState(true)
  const [derive, setDerive] = useState<'not_null' | ''>('')
  const [filterCol, setFilterCol] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const isValid = name.trim() !== '' && column !== ''

  function handleAdd() {
    onAdd({
      name: name.trim(),
      column,
      type,
      role,
      higher_is_better: higherIsBetter,
      derive: derive || null,
      filter_by: filterCol ? { column: filterCol, condition: 'not_null' } : null,
    })
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="metric-name" className="block text-xs font-semibold text-slate-500 uppercase mb-1">
            Metric Name
          </label>
          <input
            id="metric-name"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="e.g. paid_conversion"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="metric-column" className="block text-xs font-semibold text-slate-500 uppercase mb-1">
            Column
          </label>
          <select
            id="metric-column"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={column}
            onChange={e => setColumn(e.target.value)}
          >
            <option value="">— select —</option>
            {headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="metric-type" className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label>
          <select
            id="metric-type"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={type}
            onChange={e => setType(e.target.value as MetricType)}
          >
            <option value="binary">binary</option>
            <option value="continuous">continuous</option>
          </select>
        </div>
        <div>
          <label htmlFor="metric-role" className="block text-xs font-semibold text-slate-500 uppercase mb-1">Role</label>
          <select
            id="metric-role"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={role}
            onChange={e => setRole(e.target.value as MetricRole)}
          >
            <option value="primary">primary</option>
            <option value="guardrail">guardrail</option>
            <option value="secondary">secondary</option>
          </select>
        </div>
        <div>
          <label htmlFor="metric-higher" className="block text-xs font-semibold text-slate-500 uppercase mb-1">
            Higher = Better?
          </label>
          <select
            id="metric-higher"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={higherIsBetter ? 'yes' : 'no'}
            onChange={e => setHigherIsBetter(e.target.value === 'yes')}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
        <button
          type="button"
          className="text-xs text-indigo-500 font-medium"
          onClick={() => setShowAdvanced(v => !v)}
        >
          Advanced options {showAdvanced ? '▴' : '▾'}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label htmlFor="metric-derive" className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Derive
              </label>
              <select
                id="metric-derive"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={derive}
                onChange={e => setDerive(e.target.value as 'not_null' | '')}
              >
                <option value="">None</option>
                <option value="not_null">not_null</option>
              </select>
            </div>
            <div>
              <label htmlFor="metric-filter" className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Filter By Column
              </label>
              <select
                id="metric-filter"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={filterCol}
                onChange={e => setFilterCol(e.target.value)}
              >
                <option value="">— none —</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-1">
        <button
          className="flex-1 border border-slate-200 bg-white text-slate-600 rounded-md py-2 text-sm hover:bg-slate-50"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="flex-1 bg-indigo-500 text-white rounded-md py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors"
          disabled={!isValid}
          onClick={handleAdd}
        >
          Add Metric
        </button>
      </div>
    </div>
  )
}
