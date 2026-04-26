'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ReportViewV2 } from '@/components/report/ReportViewV2'
import { getExperiment } from '@/lib/experimentStore'

interface Props {
  params: Promise<{ id: string }>
}

export default function ExperimentPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const stored = getExperiment(id)

  if (!stored) {
    return (
      <div className="bg-page min-h-screen p-6">
        <div className="mx-auto max-w-2xl">
          <div className="bg-surface border border-border rounded-card px-card-x py-card-y">
            <div className="text-section font-medium text-text mb-2">
              Experiment not available
            </div>
            <p className="text-body leading-body text-muted mb-3">
              Experiment data is held in memory and is lost on page refresh or when
              the tab is closed. This link can&apos;t be reopened — start a new run
              from the homepage.
            </p>
            <Link
              href="/"
              className="text-body leading-tight text-text underline hover:no-underline"
            >
              ← Back to homepage
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-page min-h-screen p-6">
      <div className="mx-auto max-w-5xl">
        <ReportViewV2
          result={stored.result}
          config={stored.config}
          csvFile={stored.csvFile}
          onRunAnother={() => router.push('/')}
        />
      </div>
    </div>
  )
}
