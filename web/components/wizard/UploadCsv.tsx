'use client'
import { useState, useCallback } from 'react'
import type { ParsedCsv } from '@/lib/types'
import { parseCsvFile } from '@/lib/csv'

interface Props {
  onComplete: (csv: ParsedCsv) => void
}

export function UploadCsv({ onComplete }: Props) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    try {
      const parsed = await parseCsvFile(file)
      onComplete(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse CSV')
    }
  }, [onComplete])

  return (
    <div>
      <label
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 cursor-pointer transition-colors
          ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-300'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
      >
        <span className="text-3xl mb-2">📂</span>
        <span className="font-semibold text-slate-700">Drop your CSV here</span>
        <span className="text-sm text-slate-400 mt-1">or click to browse</span>
        <input
          data-testid="csv-input"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
