'use client'

import { useState, useMemo } from 'react'
import { ReportViewV2 } from '@/components/report/ReportViewV2'
import { FIXTURES, mockConfig } from './fixtures'

const CSV_PARTS = ['user_id,variant\n1,control']

export default function PreviewPage() {
  const fixtureKeys = Object.keys(FIXTURES)
  const [fixtureKey, setFixtureKey] = useState<string>(fixtureKeys[0])

  const placeholderCsv = useMemo(
    () => new File(CSV_PARTS, 'placeholder.csv', { type: 'text/csv' }),
    []
  )

  const result = FIXTURES[fixtureKey]

  return (
    <div className="bg-page min-h-screen p-6">
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="text-section font-medium text-text">ReportView V2 preview</div>
        <span className="text-meta text-muted">·</span>
        <span className="text-meta text-muted">fixture:</span>
        {fixtureKeys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFixtureKey(key)}
            className={`text-meta leading-tight rounded-pill px-3 py-1 cursor-pointer transition-colors ${
              fixtureKey === key
                ? 'bg-text text-white'
                : 'bg-surface-subtle text-text hover:bg-border'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <ReportViewV2
        key={fixtureKey}
        result={result}
        config={mockConfig}
        csvFile={placeholderCsv}
        onRunAnother={() => {}}
      />
    </div>
  )
}
